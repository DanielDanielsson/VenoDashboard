<p align="center">
  <img src="./public/static_assets/veno-logo-readme.svg" alt="Veno logo" width="260" />
</p>

<h1 align="center">VenoDashboard</h1>

<p align="center">
  Demo-first glucose dashboard for the Veno platform.
</p>

<p align="center">
  <a href="https://app.venoplatform.com/dashboard">Live demo</a>
</p>

## MVP Demo

The demo app is currently in MVP state and available here:

**https://app.venoplatform.com/dashboard**

Right now the public experience is focused on the dashboard overview and statistics pages. Admin sign in is still required for settings, API keys, timers, and other operational actions.

## What This Is

VenoDashboard is the frontend surface for the Veno ecosystem. It is built to visualize live glucose data, show trends over time, and act as a testing ground for new ideas around monitoring, health data UX, and product direction.

This project is closely tied to the work happening in the API layer. The dashboard consumes VenoAPI data, presents it in a cleaner way, and helps validate how the broader platform should feel when real data is flowing through it.

## Why It Exists

The project started as a practical way to summarize and visualize diabetes data in a way that feels more useful than the default tools. The data comes from a Dexcom sensor, a Tandem insulin pump, and step data from a phone, then gets shaped into a view that is easier to read and reason about.

It is also a side project built as a real product sandbox. The dashboard is where new visualizations, interaction patterns, and agent-assisted workflows can be tested quickly against actual use.

## Current Scope

- Public demo for overview and statistics
- Admin sign in for protected actions
- Glucose history and recent updates
- Time-in-range and AGP style analysis
- Connections and system status surfaces
- API key and settings management for admin users


## Docker

- `docker build -t veno-dashboard .`
- `docker compose up --build`
