# @openota/cli

Official CLI for [OpenOTA](https://github.com/HarshaJrDev/OpenOTA) — build, upload, and release OTA (over-the-air) packages for React Native apps.

## Install

```sh
npm install -g @openota/cli
# or run without installing:
npx @openota/cli --help
```

## Commands

```sh
openota init       # scaffold OpenOTA config in a React Native project
openota doctor      # verify your project is set up correctly
openota build        # build a release JS bundle + assets
openota upload      # upload a built package to an OpenOTA server
openota release       # build, upload and activate a release in one step
openota rollback     # roll a platform back to a previously uploaded version
openota login          # authenticate against an OpenOTA server
openota logout          # clear stored credentials
```

Run `openota <command> --help` for command-specific options.

## License

MIT
