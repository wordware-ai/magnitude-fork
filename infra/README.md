## Self-hosting Moondream

Probably the easiest way to deploy Moondream is by hosting it on Modal.

## Set up Modal
1. Create an account at modal.com
2. Run `pip install modal` to install the modal Python package
3. Run `modal setup` to authenticate (if this doesn’t work, try `python -m modal setup`)
> More info: https://modal.com/docs/guide

Modal gives $30 in free credits per month.

## Deploy Moondream

Clone Magnitude and run the `moondream.py` deploy script to automatically download the Moondream server and model weights to a Modal volume and deploy the endpoint:
```sh
git clone https://github.com/magnitudedev/magnitude.git
cd magnitude/infra
modal deploy moondream.py
```

Your Moondream endpoint will then be available at `https://<your-modal-username>--moondream.modal.run/v1`.

Then you can configure `magnitude.config.ts` with this base URL and start running tests powered by your newly deployed Moondream server!

```ts
import { type MagnitudeConfig } from 'magnitude-test';

export default {
    url: "http://localhost:5173",
    executor: {
        provider: 'moondream',
        options: {
            baseUrl: 'https://<your-modal-username>--moondream.modal.run/v1'
        }
    }
} satisfies MagnitudeConfig;
```

Keep in mind there may be some cold start times since Modal automatically scales down containers when not in use.


## Customizing Deployment

You may want to customize the modal deployment depending on your needs.

You can modify the `moondream.py` deployment script to fit your needs.

Common options you may want to change:
- `gpu`: GPU configuration. See Modal's [pricing page](https://modal.com/pricing) for details on different available GPUs and their cost.
- `scaledown_window`: Time in seconds a container will wait to shut down after receiving no requests. If higher, will let you run tests after longer without needing the container to cold-start again.
- `min_containers`: By setting this option you force Modal to keep some number of containers open to handle requests. This means Modal will also bill you for those containers all the time, but eliminates cold-starts.

