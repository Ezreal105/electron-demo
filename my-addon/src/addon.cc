#include <node_api.h>
#include <Windows.h>

bool loadLibrary(const char* dllPath, HMODULE& module) {
    module = LoadLibraryA(dllPath);
    if (module == NULL) {
        return false;
    }
    return true;
}

bool freeLibrary(HMODULE& module) {
    if (module != NULL) {
        FreeLibrary(module);
        module = NULL;
        return true;
    }
    return false;
}

typedef int(*AddFunction)(int, int);

napi_value Add(napi_env env, napi_callback_info info) {
  
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    napi_value result;
    napi_status status;
    int a = info[0].As<Napi::Number>().Int32Value();
    int b = info[1].As<Napi::Number>().Int32Value();

    HMODULE module;
    if (!loadLibrary("test.dll", module)) {
        Napi::TypeError::New(env, "Failed to load dll").ThrowAsJavaScriptException();
        return env.Null();
    }

    AddFunction addFunction = (AddFunction)GetProcAddress(module, "add");
    if (addFunction == NULL) {
        Napi::TypeError::New(env, "Failed to get function").ThrowAsJavaScriptException();
        freeLibrary(module);
        return env.Null();
    }

    int calc_result = addFunction(a, b);

    freeLibrary(module);

    status = napi_create_int64(env, calc_result, &result);
    if (status != napi_ok) return NULL;
    return result;
}


napi_value Init(napi_env env, napi_value exports) {
  napi_status status;
  napi_value fn;

  status = napi_create_function(env, NULL, 0, Add, NULL, &fn);
  if (status != napi_ok) return NULL;

  status = napi_set_named_property(env, exports, "hello", fn);
  if (status != napi_ok) return NULL;
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)