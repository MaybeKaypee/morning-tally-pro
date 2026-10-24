<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Photo counting runs the uploaded ONNX model in the browser via a dynamically imported ONNX Runtime WASM module; no paid AI fallback is used, to keep photos local and avoid AI charges.
- Store the model and matching WASM runtime assets as Lovable Assets pointers; decode the model's class-aware detection output in a separate pure module so it can be tested independently.
