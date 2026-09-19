# Model Router
Do not route purely through a free-form LLM.
Start deterministically:
if has_image_or_scan:
    require("vision")

elif task_type == "coding":
    require("coding")

elif task_type == "document":
    require("reasoning", "long_context")
Score candidates:
score =
capability_match * 0.50
+ quality_score * 0.20
+ latency_score * 0.15
+ available_gpu_score * 0.15
Then choose highest available model.
That makes model selection explainable.
