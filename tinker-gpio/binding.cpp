#include <napi.h>
#include <wiringPi.h>

using namespace Napi;

bool setup = false;

bool ensureSetup()
{
    if (setup)
        return true;

    int res = wiringPiSetup();
    if (res == 0)
    {
        setup = true;
        return true;
    }

    printf("Could not setup wiringPi: %d\n", res);

    return false;
}

Value TinkerPinMode(const CallbackInfo &info)
{
    if (!ensureSetup())
        return info.Env().Null();
    if (info.Length() < 2)
        return info.Env().Null();

    int pinNumber = info[0].As<Napi::Number>().Int32Value();
    int mode = info[1].As<Napi::Number>().Int32Value();

    pinMode(pinNumber, mode);
    return info.Env().Undefined();
}

Value TinkerDigitalRead(const CallbackInfo &info)
{
    if (!ensureSetup())
        return info.Env().Null();
    if (info.Length() < 1)
        return info.Env().Null();

    int pinNumber = info[0].As<Napi::Number>().Int32Value();
    bool result = digitalRead(pinNumber);
    return Boolean::New(info.Env(), result);
}

Value TinkerDigitalWrite(const CallbackInfo &info)
{
    if (!ensureSetup())
        return info.Env().Null();
    if (info.Length() < 2)
        return info.Env().Null();

    int pinNumber = info[0].As<Napi::Number>().Int32Value();
    bool value = info[1].ToBoolean();

    digitalWrite(pinNumber, value ? 1 : 0);

    return info.Env().Undefined();
}

Value TinkerPullUpDownControl(const CallbackInfo &info)
{
    if (!ensureSetup())
        return info.Env().Null();
    if (info.Length() < 2)
        return info.Env().Null();

    int pinNumber = info[0].As<Napi::Number>().Int32Value();
    int mode = info[1].As<Napi::Number>().Int32Value();

    pullUpDnControl(pinNumber, mode);

    return info.Env().Undefined();
}

Object Init(Env env, Object exports)
{
    exports.Set("pinMode", Function::New(env, TinkerPinMode));
    exports.Set("digitalRead", Function::New(env, TinkerDigitalRead));
    exports.Set("digitalWrite", Function::New(env, TinkerDigitalWrite));
    exports.Set("pullUpDnControl", Function::New(env, TinkerPullUpDownControl));
    return exports;
}

NODE_API_MODULE(addon, Init)