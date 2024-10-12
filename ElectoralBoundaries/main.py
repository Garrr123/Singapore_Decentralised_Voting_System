import geopandas as gpd
import matplotlib.pyplot as plt

# Load the GeoJSON file
gdf = gpd.read_file("ElectoralBoundary2020GEOJSON.geojson")

# Define colors for specific constituencies
color_map = {
    "RADIN MAS": "red",       # Change this color as needed
    "MOUNTBATTEN": "green",   # Change this color as needed
    # Add other constituencies with desired colors
}

fig, ax = plt.subplots(figsize=(10, 10))
for _, row in gdf.iterrows():
    constituency_name = row['Name']  
    color = color_map.get(constituency_name, "lightblue") 
    gpd.GeoSeries(row.geometry).plot(ax=ax, edgecolor="black", facecolor=color, alpha=0.5)

ax.set_title("Constituency Boundaries with Custom Colors")
ax.set_xlabel("Longitude")
ax.set_ylabel("Latitude")
plt.show()
