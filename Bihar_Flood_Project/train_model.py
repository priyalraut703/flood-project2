import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import pickle

# sample dataset
data = {
"rainfall":[100,200,300,150,250,320,120,180],
"elevation":[30,20,10,25,15,8,35,22],
"drain_capacity":[70,40,20,60,30,15,80,50],
"population_density":[1000,3000,5000,2000,4500,6000,1500,3500],
"impervious_surface":[40,70,90,50,80,95,35,60],
"previous_flood":[0,1,1,0,1,1,0,1],
"flood":[0,1,1,0,1,1,0,1]
}

df=pd.DataFrame(data)

X=df.drop("flood",axis=1)
y=df["flood"]

X_train,X_test,y_train,y_test=train_test_split(X,y,test_size=0.2)

model=RandomForestClassifier()

model.fit(X_train,y_train)

pickle.dump(model,open("flood_model.pkl","wb"))

print("Model trained")