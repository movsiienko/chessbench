# The scoreboard publishes every current-protocol entry automatically

Nothing selects what is published: every model and reasoning level with finished attempts under the current protocol appears as its own entry, scored on its own item set with its item count and uncertainty band shown. Results under an earlier protocol stop being published the moment the protocol changes, including for a scoring fix, and are never re-run or re-scored in place, so every published number was produced under the rules in the code. Provider errors are pending, not results, and are excluded from scores until retried.

## Consequences

- After a protocol change the scoreboard starts sparse and fills as runs finish.
- Entries with few items appear with wide bands rather than being hidden, and entries with different item sets are not directly comparable.
