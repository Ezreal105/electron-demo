{
  "targets": [
    {
      "target_name": "addon",
      "sources": [ "./src/addon.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "/usr/local/Cellar/mingw-w64/10.0.0_5/toolchain-x86_64/x86_64-w64-mingw32/include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")",
      ]
    }
  ]
}