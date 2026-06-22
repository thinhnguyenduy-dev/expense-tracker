"""Worker registry for the supervisor graph.

Single source of truth for the workers the supervisor can route to. The
supervisor prompt's WORKERS / ROUTING RULES sections AND the RouterResponse
routing enum are rendered from this list, so adding a worker means adding ONE
entry here (plus its node function + graph edge) — no prose to hand-edit in
`prompts.py`.

Keep the text brace-free: the rendered prompt is later passed through
`str.format(user_lang=...)` in `supervisor_node`, so a literal `{`/`}` here
would break that call.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Worker:
    name: str         # graph node name; also the value the supervisor routes to
    description: str  # what it does — rendered into the WORKERS section
    route_when: str   # one-line routing rule — rendered into ROUTING RULES


WORKERS: list[Worker] = [
    Worker(
        name="financial_agent",
        description=(
            "Transactional tasks AND simple data reads. Use it to:\n"
            "   - log / create an expense or income;\n"
            "   - LIST recent expenses or incomes (last N days);\n"
            "   - report this / last month's EXPENSE or INCOME total / summary."
        ),
        route_when="log expense/income, list recent (last N days), monthly total/summary",
    ),
    Worker(
        name="data_analyst",
        description=(
            "Complex analytics needing custom SQL or web research:\n"
            "   - COMPARISONS across periods ('compare this month vs last'), trends;\n"
            "   - arbitrary / multi-table aggregations not covered by the tools above;\n"
            "   - anything requiring web search (e.g. market data)."
        ),
        route_when="comparison across periods, trends, custom SQL, or web search",
    ),
    Worker(
        name="general_agent",
        description="For simple greetings and politeness.",
        route_when="greeting / chitchat / politeness",
    ),
]

# Worker names + the FINISH sentinel. Used to build the RouterResponse enum and
# to validate the supervisor's choice. Derived here so they never drift from WORKERS.
WORKER_NAMES: tuple[str, ...] = tuple(w.name for w in WORKERS)
ROUTE_OPTIONS: tuple[str, ...] = (*WORKER_NAMES, "FINISH")


def render_workers_block() -> str:
    """The numbered WORKERS list for the supervisor prompt."""
    return "\n".join(
        f"{i}. `{w.name}`: {w.description}" for i, w in enumerate(WORKERS, 1)
    )


def render_routing_block() -> str:
    """The ROUTING RULES bullets for the supervisor prompt."""
    return "\n".join(f"- {w.route_when} → `{w.name}`." for w in WORKERS)
