# Role – Scope – Journeys – Permissions Matrix

> Last updated: 2026-08-24 · Source: user-provided table (filed verbatim)

| Role | Test account | Scope | Core journeys | Can create | Can approve | Can publish | Sensitive data visible |
|---|---|---|---|---|---|---|---|
| Student | Test account | Assigned class | Learn, practise, submit | Limited | No | No | Own information only |
| Parent | Test account | Linked child | Monitor, support, consent | Limited | Where applicable | No | Linked child only |
| Servant | Test account | Assigned class | Prepare, teach, review | Yes | Limited | According to policy | Assigned learners |
| Priest | Test account | Church scope | Review, oversee, approve | According to policy | Yes | According to policy | Defined church scope |
| Administrator | Test account | Organization scope | Configure, manage | Yes | Administrative only | According to policy | Defined organization scope |

## Notes

- **"According to policy"** means governed by church/organization policy and role assignment (see `backend/src/modules/auth` and RBAC guards).
- **Sensitive data** follows least-privilege: students see own record, parents see linked child, servants see assigned class, priest sees church scope, administrator sees defined organization scope.
- **Test account** column is placeholder — replace with actual test credentials per environment (do not commit secrets).
