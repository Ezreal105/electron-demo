#include <napi.h>
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

Napi::Value Add(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }
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

    int result = addFunction(a, b);

    freeLibrary(module);

    return Napi::Number::New(env, result);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("add", Napi::Function::New(env, Add));
    return exports;
}

NODE_API_MODULE(test, Init);