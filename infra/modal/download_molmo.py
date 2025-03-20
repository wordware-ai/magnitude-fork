# ---
# args: ["--force-download"]
# ---

import modal

MODELS_DIR = "/molmo"
MODEL_NAME = "allenai/Molmo-7B-D-0924"
MODEL_REVISION = "main"

volume = modal.Volume.from_name("molmo", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install([
        "huggingface_hub",  # download models from the Hugging Face Hub
        "hf-transfer",      # download models faster with Rust
        "transformers",     # needed for loading the model
        "torch",            # PyTorch is required
        "pillow",           # for image processing 
        "soundfile",        # for audio processing
    ])
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

MINUTES = 60
HOURS = 60 * MINUTES

app = modal.App(
    image=image,
)

@app.function(volumes={MODELS_DIR: volume}, timeout=4 * HOURS)
def download_model(model_name, model_revision, force_download=False):
    from huggingface_hub import snapshot_download
    
    volume.reload()
    
    # Download all model files - don't exclude any patterns since we need all components
    snapshot_download(
        model_name,
        local_dir=MODELS_DIR + "/" + model_name,
        revision=model_revision,
        force_download=force_download,
    )
    
    volume.commit()

@app.local_entrypoint()
def main(
    model_name: str = MODEL_NAME,
    model_revision: str = MODEL_REVISION,
    force_download: bool = False,
):
    download_model.remote(model_name, model_revision, force_download)