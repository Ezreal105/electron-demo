echo building...
npm -v^
npm --prefix ./packages/addon/ i^
npm --prefix ./packages/addon/ run build^
npm --prefix ./packages/app/ i^
npm --prefix ./packages/app/ run make
