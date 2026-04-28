Always use `bd link <child> <parent> --type parent-child` for hierarchy edges (NOT `bd dep add`'s default `blocks` — wrong semantics).
For dependency edges between phases (which phase blocks which): `bd link <blocked> <blocker> --type blocks`.
For tree rendering use `bd children <id>`, NOT `bd dep tree` (which walks blocks not parent-child).
