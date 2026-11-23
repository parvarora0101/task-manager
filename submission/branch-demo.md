# Local Git Branch and Conflict Demonstration

This safe demonstration uses disposable local branches and a documentation sentence. It does not publish to any remote.

- `demo/conflict-a` changes the shared sentence to describe reviewed changes.
- `demo/conflict-b` changes the same sentence to describe tested changes.
- Merging A into B produces a content conflict on that sentence; it is resolved to say both changes are reviewed and tested.
- The merged branch is then merged into `main`.

The Git history and branch names provide the command evidence. No application code or database files were used for the conflict.
