import type { CaseStudy } from "../types";

// Sources: AetherArt repo (README.md, docs/lab_notebook.md,
// reports/experiments/exp1_sdxl/results.json, reports/what_didnt_work.md) —
// see provenance.md's AetherArt section.
export const aetherart: CaseStudy = {
  slug: "aetherart",
  title: "AetherArt",
  dek: "A Ukiyo-e style SDXL model squeezed into an 8GB consumer GPU budget — and the experiment that found the field's default quality metric can't be trusted.",
  depth: "full",
  problem: [
    "State-of-the-art image generators like Stable Diffusion XL (SDXL) normally need a 16GB+ GPU, which puts them out of reach on a consumer laptop. AetherArt fine-tunes SDXL into a Japanese ukiyo-e woodblock-print style and engineers the whole pipeline to run inside an 8GB VRAM budget, with a live public demo.",
    "It's also a small research project in its own right: the field's default way of scoring whether a generated image is good — CLIP score — turns out to silently miss real quality changes in some situations, and AetherArt set out to measure exactly when that's true rather than assume it.",
  ],
  approach: [
    "The style comes from a LoRA adapter — a small ~45MB add-on file, not a full retrained model — trained on 80 ukiyo-e images from WikiArt in 4 hours 26 minutes on a rented GCP L4 GPU, for about $3.50. Adding the trigger word \"ukyowood\" to a prompt turns the style on.",
    "Fitting everything into 8GB of VRAM took three things working together: running the model at half precision (FP16, which halves memory use), swapping in a corrected VAE (the component that turns the model's internal representation back into a viewable image) because the stock SDXL VAE silently produces black or corrupted output in FP16, and an optional 4-bit quantization mode (NF4) for even tighter budgets. A separate Hyper-SD 8-step LoRA cuts generation from the usual 25-50 steps down to 8, for a fast demo mode.",
    "Training checkpoints at 500, 1000, and 1500 steps were compared using two quality scorers — HPSv2.1 and ImageReward — instead of the more common CLIP score, because the project's own experiments found CLIP score can be blind to real quality differences (more on that below). The live demo runs on Cloud Run with an L4 GPU, adds ControlNet for composition control (steering the layout of the generated image from a reference sketch or depth map), and an NSFW safety filter.",
  ],
  architecture: {
    intro:
      "A base SDXL model composed with a style LoRA, a speed LoRA, and optional composition control — all fitted inside 8GB of VRAM.",
    stages: [
      { label: "User prompt (Gradio UI on Cloud Run)", kind: "input" },
      { label: "ModelRegistry", detail: "pipeline singleton — loads once, serves every request" },
      {
        label: "SDXL base + corrected VAE",
        detail: "madebyollin/sdxl-vae-fp16-fix — required, not optional, to avoid silent black-image failures in FP16",
      },
      {
        label: "Composable adapters",
        parallel: [
          { label: "Ukiyo-e LoRA", detail: "style — trigger word \"ukyowood\"" },
          { label: "Hyper-SD 8-step LoRA", detail: "speed — cuts 25-50 steps to 8" },
          { label: "ControlNet (Canny/depth)", detail: "composition control from a reference image" },
        ],
      },
      { label: "Optional NF4 4-bit quantization path", detail: "for tighter VRAM budgets" },
      { label: "NSFW safety guard", detail: "Falconsai/nsfw_image_detection" },
      { label: "Generated image", kind: "output" },
    ],
    note: "Offline training path (separate from serving): 80 WikiArt ukiyo-e images → diffusers LoRA training → checkpoint sweep at 500/1000/1500 steps, scored with HPSv2.1 + ImageReward on a GCP L4 → checkpoint 1000 selected → published to HuggingFace Hub.",
  },
  decisions: [
    {
      title: "FP16 plus a corrected VAE, with NF4 quantization as an optional extra step",
      body: "SDXL simply won't load in an 8GB budget without FP16 precision. But FP16 alone isn't enough — the stock SDXL VAE fails silently in FP16, producing black or corrupted images with no error, so the corrected VAE (madebyollin/sdxl-vae-fp16-fix) is treated as a required component, not an optional optimization.",
      sourceRef: "aetherart:vram",
    },
    {
      title: "HPSv2.1 and ImageReward as the real quality metric — CLIP demoted to comparison-only",
      body: "Nine experiments run across both SD 2.1 and SDXL found that CLIP score is structurally blind to rendering-level changes — things like quantization mode, sampling scheduler, or the presence of the style trigger word — while it stays responsive to semantic changes like what's actually depicted in the prompt. That made CLIP unsafe to use as the sole quality gate for engineering decisions.",
      sourceRef: "aetherart:clip-blindness",
    },
    {
      title: "Checkpoint 1000 selected by multi-scorer review, not by training loss alone",
      body: "Training loss at checkpoint 1500 dipped further than at checkpoint 1000, which would normally suggest picking 1500. But that loss drop correlated with a visible quality regression under both HPSv2.1/ImageReward scoring and human review, so checkpoint 1000 was selected instead — a case where the loss curve alone would have picked the worse model.",
      sourceRef: "aetherart:checkpoint",
    },
    {
      title: "Revised its own headline finding downward once a stricter statistical bar was applied",
      body: "The project's early claim was that CLIP score was blind to quality changes in 9 out of 9 experiments. Recomputing that claim under a stricter 1-standard-error significance threshold dropped the honest count to 4 out of 9 — and the corrected, smaller number is what the project reports, not the more dramatic original one.",
      sourceRef: "aetherart:clip-blindness",
    },
  ],
  results: [
    {
      label: "Peak VRAM, full production pipeline (SDXL FP16 + Ukiyo-e LoRA)",
      value: "6.2GB",
      detail: "inside the 8GB consumer-GPU budget; optional NF4 4-bit path uses 2.6GB for a single pipeline",
      sourceRef: "aetherart:vram",
    },
    {
      label: "Ukiyo-e LoRA quality (GCP L4, seed 42, 30 steps, 1024×1024, avg. of 4 prompts)",
      value: "HPS 0.239 · ImageReward 1.479",
      detail: "CLIP score 0.359 shown for comparison only, not as the quality bar",
      sourceRef: "aetherart:lora-quality",
    },
    {
      label: "Scheduler vs. prompt sensitivity (360-run benchmark)",
      value: "prompt choice moves CLIP score 18× more than scheduler choice",
      detail: "range 0.130 (prompt) vs. 0.007 (scheduler)",
      sourceRef: "aetherart:360-sweep",
    },
    {
      label: "Test suite",
      value: "229 tests, ~60 seconds",
      detail: "heavy GPU dependencies mocked — no GPU required to run the suite",
      sourceRef: "aetherart:tests",
    },
    {
      label: "Honest caveats",
      value: "underfitting paradox + an unresolved artifact",
      detail: "a rank-4 LoRA scores higher on CLIP than rank-8, and 20 training images beat 80 — read as CLIP rewarding literal keyword matching, not real quality; a calligraphy-cartouche artifact baked in from WikiArt caption text remains unresolved, only mitigated by negative prompting",
      sourceRef: "aetherart:caveats",
    },
  ],
  story: {
    title: "Quantization was supposed to save memory. Under CPU offload, it did the opposite.",
    body: [
      "The natural assumption is that lower-precision weights use less memory. So it was surprising when switching from FP16 to INT8 quantization, with CPU offload active, increased peak VRAM rather than decreasing it — 2,210MB versus 1,803MB, a 407MB increase in the wrong direction.",
      "The mechanism traced back to how the quantization library (bitsandbytes) actually works: it allocates a full FP16 compute buffer to dequantize the INT8 weights on every single forward pass. That dequantization buffer is a real, recurring memory cost, and under CPU offload it outweighs whatever the smaller stored weights save — only NF4's larger 4-bit compression margin is wide enough to still come out ahead in that specific regime.",
      "The project documents this plainly as \"not a bug, but a wrong assumption that cost real investigation time,\" and states the boundary condition rather than a blanket claim: on a GPU with 12GB or more and no CPU offload, INT8 does recover its expected savings; under 8GB with offload active, it doesn't. A related bug surfaced in the same area — a pipeline cache dictionary that kept accumulating multiple loaded quantized pipelines with no eviction policy — caused out-of-memory crashes that looked random until they were traced back to the cache and fixed with a single-slot cache instead.",
    ],
    sourceRef: "aetherart:int8-surprise",
  },
  links: [
    { label: "Try AetherArt", href: "https://aetherart-demo-473907703523.us-central1.run.app/" },
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/AetherArt" },
  ],
};
