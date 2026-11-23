# Offline semantic evaluation — 2026-11-23

The organizing repair ships without a language model. A temporary prototype tested Transformers.js sentence embeddings after the deterministic core and its browser workflows were working. Neither model files nor the Transformers.js runtime were added to the application dependencies or public directory.

## Candidate and method

- Transformers.js 3.8.1, its self-contained browser bundle, and ONNX Runtime Web/WASM; one inference thread in a dedicated worker.
- `Xenova/paraphrase-MiniLM-L3-v2`, q8, revision `4b544e74dfc3256b2b56849ea5d7064fee1ac846`.
- Mean-pooled, normalized sentence embeddings, compared by cosine similarity to the app's category/subcategory descriptions. No phrase-specific training or fine-tuning.
- Sixteen synthetic everyday activities, including the four requested examples and twelve additional activities. No personal records were used or transmitted.
- Isolated desktop Chrome with a 390 × 844 viewport. A separate run enabled Chrome's 4× CPU-throttling setting. This is not a physical smartphone benchmark, and throttling does not reproduce phone memory limits or guarantee identical worker throttling.
- All assets served from localhost; remote model loading disabled and non-local requests blocked. Runtime assets and model files were cached, then a fresh worker successfully ran after an offline page reload. No external inference requests occurred.

Sources: [model and files](https://huggingface.co/Xenova/paraphrase-MiniLM-L3-v2/tree/4b544e74dfc3256b2b56849ea5d7064fee1ac846), [custom local paths and remote-loading controls](https://huggingface.co/docs/transformers.js/v3.8.1/en/custom_usage), [worker guidance](https://huggingface.co/docs/transformers.js/v3.8.1/en/tutorials/react), [WASM threading and browser constraints](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).

## Asset budget

Measured file sizes, before HTTP compression:

| Asset | Bytes |
| --- | ---: |
| Quantized model | 17,452,106 |
| Tokenizer and configuration files | 712,797 |
| Self-contained Transformers.js browser script | 888,173 |
| WASM runtime | 21,596,019 |
| Runtime module | 44,484 |
| Total | 40,693,579 |

A 17.5 MB model would therefore add about **40.7 MB of uncompressed assets** with this runtime. Download size is not working memory. The memory instrumentation did not expose reliable WASM allocations, so no peak-RAM number is claimed. Memory pressure, tab eviction, and iPhone/Android compatibility remain unverified on real devices. WebAssembly is the baseline; WebGPU should remain optional. GitHub Pages should not depend on cross-origin isolation for multi-threading.

## Observed timings and classification

| Run | Pipeline initialization | Median per-item inference | Complete 16-item evaluation |
| --- | ---: | ---: | ---: |
| Initial desktop worker | 1,274 ms | 6.9 ms | 1,635 ms |
| Fresh worker after offline reload | 1,143 ms | 13.1 ms | 1,812 ms |
| Offline, Chrome 4× CPU setting | 1,945 ms | 17.5 ms | 2,670 ms |

Initialization is measured after importing the worker's JavaScript, with files delivered locally or from cache. These figures do not measure internet download time or promise comparable phone performance. Small timing differences between runs are not statistically significant.

Top-ranked category matched the expected category for **13 of 16 activities**, including all four requested examples. This tiny exploratory sample is not a general accuracy estimate. The three disagreements were:

| Activity | Expected | Predicted |
| --- | --- | --- |
| Photograph birds at the lake | Recreation | Communication / Calls |
| Get my prescription refilled | Wellness | Personal / Errands |
| Practice conversational French | Education | Communication / Calls |

Similarity scores are not probabilities. Some activities reasonably span categories. This prototype needs a larger held-out dataset, uncertainty handling and personalization before influencing user-visible suggestions.

## Decision

Keep the model out of the shipped app for now. The deterministic organizer already handles the target four-item example and works offline without a model download. The optional model's asset cost, classification errors, and unmeasured phone RAM make automatic inclusion unjustified.

If pursued later, offer an optional versioned offline pack, load it in a worker with progress/cancel/retry, retain immediate rule-based suggestions, cache model/tokenizer/runtime together, and never overwrite edits with late model results. Measure total download, first-use and warm latency, memory, cache eviction, and offline reload on ordinary iOS Safari and Android Chrome devices before enabling it. Keep only user-approved correction examples, with visible scope and edit/delete controls.
