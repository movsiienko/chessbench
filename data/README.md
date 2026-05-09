# Data

`data/benchmarks` contains tracked benchmark datasets and manifests.
Benchmark directories may also contain `indexes` files for slicing runs by
rating, move count, or theme without scanning the whole JSONL file.

`data/raw` contains downloaded upstream source files and is intentionally
ignored by git. Recreate raw files with the dataset download scripts.
