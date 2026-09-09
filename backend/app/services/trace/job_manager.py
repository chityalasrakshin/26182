"""
Asynchronous Trace Job Manager & Event Pub/Sub Broadcaster.

Manages execution lifecycle of multi-hop traces (QUEUED -> RUNNING -> COMPLETED/FAILED)
and broadcasts live progress events to Server-Sent Events (SSE) and WebSocket subscribers.
"""

import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Set, List, Any, Optional, AsyncGenerator

from backend.app.schemas.trace import TraceEvent, TraceStatusResponse
from backend.app.schemas.analysis import GraphData
from backend.app.services.trace.orchestrator import TraceOrchestrator

logger = logging.getLogger(__name__)


class TraceJobManager:
    """
    Manages active asynchronous trace executions and client subscriptions.
    """

    def __init__(self):
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.orchestrators: Dict[str, TraceOrchestrator] = {}
        self.subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self.event_history: Dict[str, List[TraceEvent]] = {}
        self._lock = asyncio.Lock()

    def create_job(
        self,
        address: str,
        chain: Optional[str] = None,
        max_depth: int = 6,
    ) -> str:
        job_id = f"trace_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        self.jobs[job_id] = {
            "job_id": job_id,
            "address": address,
            "chain": chain or "auto",
            "status": "QUEUED",
            "max_depth": max_depth,
            "current_depth": 0,
            "started_at": now,
            "completed_at": None,
            "num_nodes": 1,
            "num_edges": 0,
            "num_transactions": 0,
            "vasp_found": False,
            "matched_vasps": [],
            "shortest_path": None,
            "leaf_nodes": [],
            "is_cached": False,
            "error_message": None,
            "summary": "Trace job queued for asynchronous execution."
        }
        self.subscribers[job_id] = set()
        self.event_history[job_id] = []
        return job_id

    async def publish_event(self, event: TraceEvent):
        """Dispatches an event to all active subscribers and updates history."""
        job_id = event.job_id
        if job_id not in self.event_history:
            self.event_history[job_id] = []
        self.event_history[job_id].append(event)

        # Update job snapshot based on event
        if job_id in self.jobs:
            self.jobs[job_id]["current_depth"] = event.hop
            if event.event == "JOB_STARTED":
                self.jobs[job_id]["status"] = "RUNNING"
            elif event.event == "NODE_DISCOVERED":
                self.jobs[job_id]["num_nodes"] = self.jobs[job_id].get("num_nodes", 0) + 1
            elif event.event == "EDGE_ADDED":
                self.jobs[job_id]["num_edges"] = self.jobs[job_id].get("num_edges", 0) + 1
            elif event.event == "VASP_REACHED":
                self.jobs[job_id]["vasp_found"] = True

        queues = list(self.subscribers.get(job_id, set()))
        for q in queues:
            try:
                await q.put(event)
            except Exception as e:
                logger.debug(f"Error publishing to subscriber queue for {job_id}: {e}")

    async def subscribe(self, job_id: str) -> AsyncGenerator[TraceEvent, None]:
        """
        Subscribes to live events for a job.
        Replays past events first, then streams new events as they happen.
        """
        q: asyncio.Queue = asyncio.Queue()

        async with self._lock:
            if job_id not in self.subscribers:
                self.subscribers[job_id] = set()
            self.subscribers[job_id].add(q)
            history = list(self.event_history.get(job_id, []))

        # Replay event history
        for ev in history:
            yield ev

        # If job already completed, stop
        if self.jobs.get(job_id, {}).get("status") in ("COMPLETED", "FAILED"):
            async with self._lock:
                self.subscribers.get(job_id, set()).discard(q)
            return

        # Stream new events
        try:
            while True:
                event = await q.get()
                yield event
                if event.event in ("TRACE_COMPLETED", "TRACE_FAILED"):
                    break
        finally:
            async with self._lock:
                self.subscribers.get(job_id, set()).discard(q)

    async def execute_trace(self, job_id: str):
        """Worker task executing the trace in background."""
        if job_id not in self.jobs:
            logger.error(f"Cannot execute unknown trace job {job_id}")
            return

        job_data = self.jobs[job_id]
        address = job_data["address"]
        chain = job_data["chain"] if job_data["chain"] != "auto" else None
        max_depth = job_data.get("max_depth", 3)
        orchestrator = TraceOrchestrator(
            seed_address=address,
            chain=chain,
            max_depth=max_depth,
            job_id=job_id,
            event_callback=self.publish_event
        )
        self.orchestrators[job_id] = orchestrator

        try:
            result = await orchestrator.run_trace()
            self.jobs[job_id].update(result)
            self.jobs[job_id]["status"] = "COMPLETED"
        except Exception as e:
            logger.error(f"Trace execution failed for job {job_id}: {e}", exc_info=True)
            self.jobs[job_id]["status"] = "FAILED"
            self.jobs[job_id]["error_message"] = str(e)
            await self.publish_event(
                TraceEvent(
                    event="TRACE_FAILED",
                    job_id=job_id,
                    hop=self.jobs[job_id].get("current_depth", 0),
                    timestamp=datetime.now(timezone.utc),
                    data={"error": str(e)}
                )
            )

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return self.jobs.get(job_id)

    def get_job_graph(self, job_id: str) -> Optional[GraphData]:
        orch = self.orchestrators.get(job_id)
        if orch:
            return orch.export_cytoscape_data()
        return None


# Global singleton instance
trace_job_manager = TraceJobManager()
