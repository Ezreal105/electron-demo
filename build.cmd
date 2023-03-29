#! /bin/bash
echo building...

npm -v
npm i &
npm run build --workspace=addon &
npm run build --workspace=app