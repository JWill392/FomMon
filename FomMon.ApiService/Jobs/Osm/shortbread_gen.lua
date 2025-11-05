-- ---------------------------------------------------------------------------
--
-- Shortbread theme with generalization
--
-- Configuration for the osm2pgsql Themepark framework
--
-- ---------------------------------------------------------------------------


local themepark = require('themepark')

-- *** REQUIRED ENV VARIABLE: OSM_SCHEMA *** --
local schema = assert(os.getenv('OSM_SCHEMA'), "Environment variable OSM_SCHEMA is not set")
themepark:set_option('schema', schema)


-- For debug mode set this or the environment variable THEMEPARK_DEBUG.
--themepark.debug = true

-- Add JSONB column `tags` with original OSM tags in debug mode
themepark:set_option('tags', 'all_tags')

-- Set this to add a column 'id' with unique IDs (and corresponding unique
-- index). This is needed for instance when you want to edit the data in QGIS.
themepark:set_option('unique_id', 'id')

themepark:add_topic('core/name-single', { column = 'name' })

-- --------------------------------------------------------------------------

themepark:add_topic('core/layer')

themepark:add_topic('external/oceans', { name = 'ocean' })

themepark:add_topic('shortbread_v1/aerialways')
themepark:add_topic('shortbread_v1_gen/boundaries')
themepark:add_topic('shortbread_v1/boundary_labels')
themepark:add_topic('shortbread_v1/bridges')
themepark:add_topic('shortbread_v1/buildings')
themepark:add_topic('shortbread_v1/dams')
themepark:add_topic('shortbread_v1/ferries')
themepark:add_topic('shortbread_v1_gen/land')
themepark:add_topic('shortbread_v1/piers')
themepark:add_topic('shortbread_v1/places')
themepark:add_topic('shortbread_v1/pois')
themepark:add_topic('shortbread_v1/public_transport')
themepark:add_topic('shortbread_v1/sites')
themepark:add_topic('shortbread_v1_gen/streets')
themepark:add_topic('shortbread_v1_gen/water')

-- Must be after "pois" layer, because as per Shortbread spec addresses that
-- are already in "pois" should not be in the "addresses" layer.
themepark:add_topic('shortbread_v1/addresses')
