echo building...
set GYP_MSVS_VERSION=2015 ^
npm -v^
npm --prefix ./packages/addon/ i^
npm --prefix ./packages/addon/ run build^
npm --prefix ./packages/app/ i^
npm --prefix ./packages/app/ run make
