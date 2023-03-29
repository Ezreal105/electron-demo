echo building...
npm -v &^
set GYP_MSVS_VERSION=2019 &^
npm --prefix ./packages/addon/ i &^
npm --prefix ./packages/addon/ run build &^
npm --prefix ./packages/app/ i &^
set GYP_MSVS_VERSION=2019 & npm --prefix ./packages/app/ run make 
