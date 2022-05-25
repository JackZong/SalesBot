import { PuppetPadlocal } from "wechaty-puppet-padlocal";
import { PuppetXp } from "wechaty-puppet-xp";
import { log, ScanStatus, WechatyBuilder } from "wechaty";
import FormData from "form-data";
import axios from "axios";
import { tids, floors, naids, loids } from "../lib/floors";
import * as accounts from "../lib/accounts";
import { getTidByText } from "../lib/keywords";
import { finch } from "./saleBot";

// 去掉注释，可以完全打开调试日志
// log.level("silly");

// const puppet = new PuppetPadlocal({
//   token: "puppet_padlocal_41c81610edfc4d25836d0589a747c8a5",
// });

const puppet = new PuppetXp();
/**
 * Sales API
 */

const types = {
  sold: "fw_ysfw",
  forSale: "fw_zz",
  booked: "fw_yrgfw",
  carForSale: "fw_ck",
};

const APIs = {
  search: "http://fdc.zfj.xm.gov.cn/home/Getzslp",
  getFloors: "http://fdc.zfj.xm.gov.cn/LP/Index",
};

const getFloorIds = (text: string) => {};

const getFloors = async (tid: string, projectName: string = "tp2022") => {
  const response = await axios.get(
    APIs.getFloors + `?transactionid=${tid}&projectName=${projectName}`
  );
  const domStr: string = response.data.toString();
  const filteredFloor = domStr
    .match(/<li>.+javascript:DispLp(.+)<\/li>/g)
    ?.filter((item) => !item.includes("单列") && !item.includes("公共车位"));

  if (!filteredFloor) return;
  const temp: { [key: string]: string } = {};
  for (const floor of filteredFloor) {
    const floorIdArr = floor.match(/\d+/i);
    if (floorIdArr && floorIdArr.length) {
      const key = floorIdArr[0];
      temp[key] = floor.match(/,\d+,/i)?.[0].replace(/,/g, "") || "";
    }
  }
  const naidsArr = Array.from(new Set(Object.entries(temp)));
  // const allFloorNos = domStr
  //   .match(/<span class="folder">.+<\/span>/g)
  //   .map((item) => item.match(/[\d|地下室]+/g)[0]);

  const floors: { [key: string]: any } = {};
  Object.keys(temp).forEach((floorId, index) => {
    const naid = temp[floorId];
    if (floors[naid]) {
      floors[naid + `-1`] = floorId;
      return;
    }
    floors[naid] = floorId;
  });
  console.log(floors);
  const result = {
    floors,
    naids: {},
    loids: {},
  };
};

const searchFloor = async (text: string) => {
  const formData = new FormData();
  formData.append("currentpage", 1);
  formData.append("pagesize", 20);
  formData.append("searchtj", "XMMC like" + text);
  const response = await axios.post(APIs.search, formData);
  console.log(response);
  if (!response.data.result) return;
  if (!response.data.Body.bodylist.length) return;
  return response.data.Body.bodylist[0].TRANSACTION_ID;
};

const getSaleData = async (tid: string) => {
  const result: { [key: string]: any } = {};
  let sumary = { sold: 0, total: 0, rate: 0 };
  for (const floor in floors[tid]) {
    const formData = new FormData();
    formData.append("NAID", naids[tid][floor]);
    formData.append("lotid", loids[tid][floor]);
    formData.append("BuildID", floors[tid][floor]);
    const res = await (
      await axios.post("http://fdc.zfj.xm.gov.cn/Lp/LPPartial?", formData)
    ).data.toString();
    const sold = res.match(new RegExp(types.sold, "g"))?.length ?? 0;
    const forSale =
      res.match(
        new RegExp(
          floor === "car" || floor === "car1"
            ? types.carForSale
            : types.forSale,
          "g"
        )
      )?.length ?? 0;
    const booked = res.match(new RegExp(types.booked, "g"))?.length ?? 0;
    const total = sold + forSale + booked;
    if (floor !== "car" && floor !== "car1") {
      sumary.sold += sold + booked;
      sumary.total += total;
    }
    result[floor] = {
      sold,
      forSale,
      booked,
      total,
      saleRate: `${Math.ceil(((booked + sold) / total) * 100)}%`,
    };
  }
  sumary.rate = Math.ceil((sumary.sold / sumary.total) * 100);
  result.sumary = sumary;
  console.log("result:", result);
  return result;
};

/**
 * Sale Bot
 */

const saleBot = WechatyBuilder.build({
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
    // console.log("id", message.room()?.id);
    // console.log("mentionself", await message.mentionSelf());
    // console.log("mentionList", await message.mentionList());
    // console.log("mentionText", await message.mentionText());
    // console.log("text", message.text());
    // console.log("payload", message.payload);

    const isRoomMsg = message.room();
    const tid = getTidByText(await message.mentionText());
    const mentionSelf = await message.mentionSelf();
    if (
      isRoomMsg &&
      (message.text().includes("你叫什么") ||
        message.text().includes("你是谁")) &&
      mentionSelf
    ) {
      message.room()?.say("你好，我是Finch！");
      return;
    }
    if (isRoomMsg && mentionSelf) {
      if (!tid) {
        message.room()?.say("这个问题Finch还不懂呢！");
        return;
      }
      const searchResult = await finch(message.text());
      const today = new Date();
      const time =
        today.toLocaleDateString() +
        " " +
        today.toLocaleTimeString("en-US", { hour12: false });

      let body = "";
      ///
      for (const item in searchResult) {
        Object.keys(searchResult[item]).map((floor) => {
          if (floor === "sumary") return;
          body += `
        ${
          floor === "car" || floor === "car1"
            ? `车位(${floor === "car" ? "负一" : "负二"})`
            : floor + "号楼"
        }: 共${sales[floor].total} | 销售率(${sales[floor].saleRate})
      已售(${sales[floor].sold}) | 已认购(${sales[floor].booked}) | 未售(${
            sales[floor].forSale
          })
      `;
        });
      }

      const template = `\u00A0
      🌟${tids[tid]}销售数据🌟

        已售:${sales.sumary.sold}  去化:${sales.sumary.sold}/${sales.sumary.total}=${sales.sumary.rate}%
 ________________________________
    ${body}
   查询时间: ${time}
   数据来源: 网上房地产
`;
      await message.room()?.say(template);
    }
  })

  .on("error", (error) => {
    log.error("TestBot", "on error: ", error.stack);
  });

saleBot.start().then(() => {
  log.info("TestBot", "started.");
});

// searchFloor("环东时代");
// getFloors("100003209575");