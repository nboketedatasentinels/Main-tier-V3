# Loading state guidelines

## When to use each variant
- **Full-screen (`fullScreen`)**: use for global flows like logout, auth handoffs, and route transitions where the entire app is blocked.
- **Inline (`fullScreen={false}`)**: use for page-level data fetching, dashboard panels, and section refreshes where only a portion of the UI is waiting.
- **Inline + `inline`**: use for compact loaders inside list items, badges, or validation hints where layout shifts should be minimal.

## Size options
- `small`: compact inline surfaces (lists, badges, lightweight status). 
- `medium`: panel or modal loading states.
- `large`: full-page or prominent page loading states.
