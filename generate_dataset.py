import pandas as pd
import random

rows = []

for i in range(500):

    rainfall = random.randint(50,350)  # Bihar monsoon rainfall
    elevation = random.randint(20,120) # low elevation flood plains
    drain_capacity = random.randint(20,100)
    population_density = random.randint(3000,15000)
    impervious_surface = random.randint(20,90)
    previous_flood = random.randint(0,1)

    flood = 0

    if rainfall > 200 and drain_capacity < 50:
        flood = 1
    elif rainfall > 150 and impervious_surface > 70:
        flood = 1
    elif previous_flood == 1 and rainfall > 120:
        flood = 1

    rows.append([
        rainfall,
        elevation,
        drain_capacity,
        population_density,
        impervious_surface,
        previous_flood,
        flood
    ])

columns = [
"rainfall",
"elevation",
"drain_capacity",
"population_density",
"impervious_surface",
"previous_flood",
"flood"
]

df = pd.DataFrame(rows,columns=columns)

df.to_csv("flood_dataset.csv",index=False)

print("Dataset Generated Successfully")
