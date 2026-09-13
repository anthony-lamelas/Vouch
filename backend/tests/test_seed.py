from app.seed.generate import generate_graph


def test_graph_is_deterministic() -> None:
    a = generate_graph(seed=7, employee_count=8, contact_count=120)
    b = generate_graph(seed=7, employee_count=8, contact_count=120)
    assert [c.linkedin_url for c in a.contacts] == [c.linkedin_url for c in b.contacts]
    assert [(x.employee_idx, x.contact_idx, x.strength) for x in a.connections] == [
        (x.employee_idx, x.contact_idx, x.strength) for x in b.connections
    ]


def test_curated_demo_contacts_connect_to_bob() -> None:
    g = generate_graph(seed=1, employee_count=6, contact_count=50)
    assert g.employees[0].full_name == "Bob Rivera"
    names = {c.full_name for c in g.contacts[:3]}
    assert names == {"Priya Natarajan", "Marcus Oyelaran", "Elena Vasquez"}
    priya_edges = [c for c in g.connections if c.contact_idx == 0]
    bob_edge = next(c for c in priya_edges if c.employee_idx == 0)
    assert bob_edge.breakdown["overlap"] == 1.0
    assert "Stripe" in bob_edge.breakdown["overlap_detail"]


def test_every_contact_has_a_connection() -> None:
    g = generate_graph(seed=3, employee_count=10, contact_count=200)
    connected = {c.contact_idx for c in g.connections}
    assert connected == set(range(len(g.contacts)))
    assert all(0 <= c.strength <= 1 for c in g.connections)
