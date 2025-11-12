# FomMon - A GIS monitoring web app for BC Canada

A simple GIS app for watching areas of interest for changes.  Integrates with British Columbia Geographic Warehouse to retrieve government-wide GIS data, as well as Open Street Map.  A land manager might use this to be notified of new trails on their property, or a recreation club may wish to be notified of planned logging operations.

This project is in early development. It's a personal project to learn c# + angular development. Many design choices were made to learn libraries, and are not necessarily pragmatic. 

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshot-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="screenshot-light.png">
  <img alt="A screenshot of the application showing a map with areas watched for changes" src=screenshot-light.png>
</picture>


## Features
 - Watch specified areas for changes
 - Select from a variety of data sources:
   - Planned logging cutblocks (Forest Operations Map)
   - Current and historical wildfires
   - Open Street Map (OSM) (Base map + feature monitoring)
   - (more to come; BC Geographic Warehouse layers trivial to add)

## Roadmap
 - Activity feed view
 - Email notifications
 - Quick-add watches with sane presets
 - Filtering criteria for watches
 - Deploy demo
 - RProxy + caching
 - Landing page

## Built With
 - Backend
   - API:
     - C#
     - ASP.NET CORE
     - .NET Aspire orchestration
     - Entity Framework Core
     - Hangfire background jobs
   - PostgreSQL database + PostGIS
     - ogr2pgsql + themepark for downloading OSM data
   - MapLibre Martin Tileserver
   - Keycloak authentication
   - MinIO object storage
   - Redis caching & hangfire persistence
 - Frontend:
   - Typescript
   - Angular 20
   - MapLibre GL JS
     - Shortbread schema + Versatiles styles

## License
Distributed under the GNU GPLv3.  See LICENSE.txt for more information.

### Third-Party Software
This project uses osm2pgsql-themepark (Apache 2.0 License)
https://github.com/osm2pgsql-dev/osm2pgsql-themepark
