import { PuppetPadlocal } from "wechaty-puppet-padlocal";
import { PuppetXp } from "wechaty-puppet-xp";
import { log, ScanStatus, WechatyBuilder } from "wechaty";

import * as accounts from "../lib/accounts";
// 去掉注释，可以完全打开调试日志
// log.level("silly");

const puppet = new PuppetPadlocal({
  token: "puppet_padlocal_41c81610edfc4d25836d0589a747c8a5",
});

// const puppet = new PuppetXp();


/**
 * Sale Bot
 */

const InviteBot = WechatyBuilder.build({
  name: "TestBot",
  puppet
})

  .on("scan", (qrcode, status) => {
    if (status === ScanStatus.Waiting && qrcode) {
      const qrcodeImageUrl = [
        "https://wechaty.js.org/qrcode/",
        encodeURIComponent(qrcode)
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

  .on("login", user => {
    log.info("TestBot", `${user} login`);
  })

  .on("logout", (user, reason) => {
    log.info("TestBot", `${user} logout, reason: ${reason}`);
  })

  .on("message", async message => {
    log.info("TestBot", `on message: ${message.toString()}`);
  })

  .on("error", error => {
    log.error("TestBot", "on error: ", error.stack);
  })

  .on("room-join", async (room, inviteeList, inviter)=>{
    log.info( 'Bot', 'EVENT: room-join - Room "%s" got new member "%s", invited by "%s"',
    await room.topic(),
    inviteeList.map(c => c.name()).join(','),
    inviter.name(),
    room.say('welcome to the group',inviteeList[0])
  )
  });

  InviteBot.start().then(() => {
    log.info("TestBot", "started.");
  });