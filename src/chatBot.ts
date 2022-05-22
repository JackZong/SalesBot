import { PuppetPadlocal } from "wechaty-puppet-padlocal";
import { log, ScanStatus, WechatyBuilder } from "wechaty";

// 去掉注释，可以完全打开调试日志
// log.level("silly");

const senLin = "wxid_kquzdy2vqfxr22";
const me = "wxid_4z7iza3akh0g31";
const huanDong = "25766000416@chatroom";
const puppet = new PuppetPadlocal({
  token: "puppet_padlocal_41c81610edfc4d25836d0589a747c8a5",
});

const threePeople = "22465943796@chatroom";

/**
 * Sale Bot
 */
const bot = WechatyBuilder.build({
  name: "TestBot",
  puppet,
})

  .on("scan", (qrcode, status) => {
    if (status === ScanStatus.Waiting && qrcode) {
      const qrcodeImageUrl = [
        "https://wechaty.js.org/qrcode/",
        encodeURIComponent(qrcode),
      ].join("");

      log.info(
        "TestBot",
        `onScan: ${ScanStatus[status]}(${status}) - ${qrcodeImageUrl}`
      );

      require("qrcode-terminal").generate(qrcode, { small: true }); // show qrcode on console
    } else {
      log.info("TestBot", `onScan: ${ScanStatus[status]}(${status})`);
    }
  })

  .on("login", (user) => {
    log.info("TestBot", `${user} login`);
  })

  .on("logout", (user, reason) => {
    log.info("TestBot", `${user} logout, reason: ${reason}`);
  })

  .on("message", async (message) => {
    log.info("TestBot", `on message: ${message.toString()}`);

    // ding-dong bot
    if (
      message.text().indexOf("ding") !== -1 &&
      (message.talker().id === senLin || message.talker().id === me)
    ) {
      await message.talker().say("dong");
    }
  })

  .on("error", (error) => {
    log.error("TestBot", "on error: ", error.stack);
  });

bot.start().then(() => {
  log.info("TestBot", "started.");
});
