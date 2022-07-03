import { PuppetXp } from "wechaty-puppet-xp";
import { PuppetMock, mock } from "wechaty-puppet-mock";
import { log, ScanStatus, WechatyBuilder } from "wechaty";
import { saleBotHandler } from "./saleBot";
import { finchBot } from "./helloFinch";
import { SimpleEnvironmentStart } from "./testBot";

// 去掉注释，可以完全打开调试日志
// log.level("silly");

const mocker = new mock.Mocker();

const puppet =
  process.env.NODE_ENV === "DEV" ? new PuppetMock({ mocker }) : new PuppetXp();

/**
 * Finch Bot
 */

const Finch = WechatyBuilder.build({
  name: "FinchBot",
  puppet,
})

  .on("scan", (qrcode, status) => {
    if (status === ScanStatus.Waiting && qrcode) {
      const qrcodeImageUrl = [
        "https://wechaty.js.org/qrcode/",
        encodeURIComponent(qrcode),
      ].join("");

      log.info(
        "FinchBot",
        `onScan: ${ScanStatus[status]}(${status}) - ${qrcodeImageUrl}`
      );

      require("qrcode-terminal").generate(qrcode, { small: true }); // show qrcode on console
    } else {
      log.info("FinchBot", `onScan: ${ScanStatus[status]}(${status})`);
    }
  })

  .on("login", (user) => {
    log.info("FinchBot", `${user} login`);
  })

  .on("logout", (user, reason) => {
    log.info("FinchBot", `${user} logout, reason: ${reason}`);
  })

  .on("message", async (message) => {
    // log.info("FinchBot", `on message: ${message.toString()}`);
  })
  .on("message", finchBot)
  .on("message", saleBotHandler)

  .on("error", (error) => {
    log.error("FinchBot", "on error: ", error.stack);
  });

Finch.start().then(() => {
  log.info("FinchBot", "started.");
});

if (process.env.NODE_ENV === "DEV") {
  mocker.use(SimpleEnvironmentStart);
}
