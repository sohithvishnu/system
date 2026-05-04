"""
Network topology route.
Endpoint: GET /api/network/topology

Builds a force-directed graph from the user's identity_matrix.
Replaces the SQLAlchemy stub in topology.py.
"""

from fastapi import APIRouter, Query

from backend.db import get_db

router = APIRouter(prefix="/api", tags=["Network"])


@router.get("/network/topology")
async def get_network_topology(
    user_id: str = Query(..., description="User ID for filtering facts"),
):
    """
    Query identity_matrix and build a force-directed graph with nodes and links.

    Topology structure:
    - Core node: USER (green, group 1, size 20)
    - Category nodes: GOALS, PREFERENCES, FACTS (white, group 2, linked to USER)
    - Person nodes: one per unique person in PERSON memories (red, group 3)
    - Fact nodes: one per memory entry (dark, group 4)
    """
    try:
        conn = get_db()
        conn.row_factory = __import__("sqlite3").Row
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, category, fact FROM identity_matrix
            WHERE user_id = ?
            ORDER BY category, timestamp DESC
            """,
            (user_id,),
        )
        facts = [dict(row) for row in cursor.fetchall()]
        conn.close()

        nodes: list = []
        links: list = []
        node_ids: set = set()

        # Core USER node
        nodes.append({"id": "USER", "group": 1, "val": 20, "color": "#00FF66", "label": "USER"})
        node_ids.add("USER")

        # Category nodes
        for category in ("GOALS", "PREFERENCES", "FACTS"):
            if category not in node_ids:
                nodes.append(
                    {"id": category, "group": 2, "val": 15, "color": "#FFFFFF", "label": category}
                )
                node_ids.add(category)
                links.append({"source": "USER", "target": category, "value": 1})

        person_nodes: dict = {}

        for fact in facts:
            fact_id = fact["id"]
            category = fact["category"]
            fact_text = fact["fact"]

            if category == "PERSON":
                parts = fact_text.split("::")
                if len(parts) == 2:
                    person_name = parts[0].strip()
                    specific_fact = parts[1].strip()

                    if person_name not in person_nodes:
                        person_node_id = f"PERSON_{person_name.replace(' ', '_')}"
                        if person_node_id not in node_ids:
                            nodes.append(
                                {
                                    "id": person_node_id,
                                    "group": 3,
                                    "val": 12,
                                    "color": "#FF2C55",
                                    "label": person_name,
                                }
                            )
                            node_ids.add(person_node_id)
                            links.append({"source": "USER", "target": person_node_id, "value": 1})
                        person_nodes[person_name] = person_node_id

                    fact_node_id = fact_id
                    if fact_node_id not in node_ids:
                        nodes.append(
                            {
                                "id": fact_node_id,
                                "group": 4,
                                "val": 8,
                                "color": "#1a1a1a",
                                "label": (
                                    specific_fact[:30] + "..."
                                    if len(specific_fact) > 30
                                    else specific_fact
                                ),
                            }
                        )
                        node_ids.add(fact_node_id)
                        links.append(
                            {"source": person_nodes[person_name], "target": fact_node_id, "value": 1}
                        )
            else:
                category_node_target = None
                if category == "GOAL":
                    category_node_target = "GOALS"
                elif category == "PREFERENCE":
                    category_node_target = "PREFERENCES"
                elif category in ("FACT", "IDENTITY"):
                    category_node_target = "FACTS"

                fact_node_id = fact_id
                if fact_node_id not in node_ids:
                    nodes.append(
                        {
                            "id": fact_node_id,
                            "group": 4,
                            "val": 8,
                            "color": "#1a1a1a",
                            "label": (
                                fact_text[:30] + "..." if len(fact_text) > 30 else fact_text
                            ),
                        }
                    )
                    node_ids.add(fact_node_id)

                    if category_node_target and category_node_target in node_ids:
                        links.append(
                            {"source": category_node_target, "target": fact_node_id, "value": 1}
                        )

        print(
            f"[TOPOLOGY_GENERATED] User {user_id}: {len(nodes)} nodes, {len(links)} links"
        )
        return {
            "success": True,
            "nodes": nodes,
            "links": links,
            "total_nodes": len(nodes),
            "total_links": len(links),
        }

    except Exception as e:
        print(f"[ERROR_TOPOLOGY] {str(e)}")
        return {"success": False, "error": str(e)}
