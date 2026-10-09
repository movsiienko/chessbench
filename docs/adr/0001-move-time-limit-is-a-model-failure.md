# Exceeding the move time limit is a model failure

Benchmark runs execute on Vercel Hobby, where one function invocation, and so one model call, ends at 300 seconds. We set a 270-second move time limit and score an exceeded limit as a failed turn, like a wrong move, rather than as a retryable infrastructure error. A model that is consistently slower than the limit would otherwise be paid for on every run and never finish. The limit is part of the protocol, so raising it later, for example on a paid plan, produces separate results instead of mixing with these.
