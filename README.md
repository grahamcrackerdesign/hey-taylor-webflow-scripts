# hey-taylor-webflow-scripts

Front-end scripts for the Hey Taylor Webflow site.

| Script | Purpose |
| --- | --- |
| [`insights-filter.js`](insights-filter.js) | Multi-select category filter for the Insights CMS collection, URL-synced. See [handoff notes](insights-filter-handoff.md). |
| [`inline-video.js`](inline-video.js) | Overlay play button for inline videos; hides while playing, click video to pause. |

Each script is standalone and self-documenting — read the banner comment at
the top for its required Webflow hooks and where to load it.

## Loading

Paste inside a `<script defer>` block in Webflow custom code, or load from CDN:

```html
<script defer src="https://cdn.jsdelivr.net/gh/grahamcrackerdesign/hey-taylor-webflow-scripts@main/inline-video.js"></script>
```
