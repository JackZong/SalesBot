import axios from "axios";
import FormData, { promises } from "form-data";
import { JSDOM } from "jsdom";
import { Message } from "wechaty";
import * as accounts from "../lib/accounts";
import { APIs } from "../lib/api";
import { helloFinch } from "./helloFinch";

export interface Body {
  currentpage: number;
  pagesize: number;
  bodylist: {
    TRANSACTION_ID: string;
    YSXKZH: string;
    XMMC: string;
    APPROVALDATE: string;
  }[];
}

export interface Floors {
  [key: string]: any;
}

const floorsCache: { [key: string]: any } = {};
const floorsCacheTime: { [key: string]: number } = {};

export interface Naids extends Floors {}

export interface Loids extends Floors {}

export interface FloorTable {
  sold: string;
  forSale: string;
  booked: string;
  // carForSale: string;
  pledge: string;
  cannotSale: string;
  fw_zjgcdy: string;
  summary: {
    totalSold: number;
    total: number;
    saleRate: number;
  };
}

const types = {
  sold: "fw_ysfw",
  forSale: "fw_zz",
  booked: "fw_yrgfw",
  carForSale: "fw_ck",
  pledge: "fw_tddy",
  cannotSale: "fw_bksfw",
  fw_zjgcdy: "fw_zjgcdy",
};

const folderNameReg = {
  format1: /\d+号楼住宅/,
  format2: /\w+\d+-\d+号楼\w+梯住宅/,
  format3: /^\w+梯住宅/,
  format4: /.+\d+号住宅/,
};

let projectNames: string[] = [];

const searchFloor = async (text: string) => {
  const formData = new FormData();
  formData.append("currentpage", 1);
  formData.append("pagesize", 20);
  formData.append("searchtj", "XMMC like " + text);
  const response = await axios.post(APIs.search, formData);
  const body: Body = JSON.parse(response.data.Body);
  let result;
  if (body.bodylist.length) {
    result = body.bodylist.map((item) => item.TRANSACTION_ID);
  }
  return result;
};

const getFloors = async (tid: string, projectName: string = "tp2022") => {
  const response = await axios.get(
    APIs.getFloors + `?transactionid=${tid}&projectName=${projectName}`
  );
  const domStr: string = response.data.toString();
  const { document } = new JSDOM(domStr).window;

  const matchResult = Array.from(
    document.querySelectorAll("ul#browser>li>ul>li")
  );

  const houses = matchResult?.filter((item) => item.innerHTML.includes("住宅"));
  if (!houses.length) return;
  const garages = matchResult?.filter((item) =>
    item.innerHTML.includes("车库")
  );

  const houseIds: { [key: string]: any } = {};
  const naids: { [key: string]: any } = {};
  const loids: { [key: string]: any } = {};
  for (const floor of houses) {
    const folderName = floor.querySelector("span[class*=folder]")?.textContent;
    const allAreas = Array.from(floor.querySelectorAll("ul>li")).filter(
      (item) => item.innerHTML?.includes("住宅")
    );
    const allAreasHasTi =
      allAreas.filter((item) => item.innerHTML.includes("梯住宅")).length > 0;
    const specReg = /、|\d+-\d+号楼/;
    const id =
      folderName &&
      specReg.test(folderName) &&
      allAreas.length > 1 &&
      !allAreasHasTi
        ? "spec"
        : folderName
            ?.replaceAll(/(S-*\d+号楼)/g, "")
            .replaceAll(/(\w*\d+-\d+号楼裙房)/g, "")
            .replaceAll(/(\w*\d*号楼商业)/g, "")
            .replaceAll(/号|楼|住|宅/g, "")
            .replaceAll("、", "");
    if (!id) return;
    for (const area of allAreas) {
      const href = area.querySelector("a");
      if (!href) return;
      const ids = href.href.match(/\d+/g);
      let firstName = id;
      let name = firstName;
      if (allAreas.length > 1) {
        let secondary;
        if (href.textContent?.match(folderNameReg.format1)) {
          secondary = href.textContent?.replace("号楼住宅", "");
        } else if (href.textContent?.match(folderNameReg.format2)) {
          secondary = href.textContent
            ?.replace("号楼", "-")
            .replace("梯住宅", "");
        } else if (href.textContent?.match(folderNameReg.format3)) {
          secondary = href.textContent?.replace("梯住宅", "");
        } else if (href.textContent?.match(folderNameReg.format4)) {
          secondary = href.textContent?.match(/\d+/)?.[0];
        }

        name =
          firstName !== "spec"
            ? `${firstName}-${secondary}`
            : secondary || firstName;
      }
      houseIds[name] = ids?.[0];
      naids[name] = ids?.[1];
      loids[name] = ids?.[2];
    }
  }

  const result = {
    floors: houseIds,
    naids,
    loids,
  };
  // console.log(result);
  return result;
};

const getSaleData = async (floors: Floors, naids: Naids, loids: Loids) => {
  const result: { [key: string]: FloorTable } = {};
  for (const floor in floors) {
    if (
      floorsCache[floor] &&
      floorsCacheTime[floor] &&
      Date.now() - floorsCacheTime[floor] > 600 * 1000
    ) {
      console.log("hit cache");
      result[floor] = floorsCache[floor];
      return;
    }
    const formData = new FormData();
    formData.append("NAID", naids[floor]);
    formData.append("lotid", loids[floor]);
    formData.append("BuildID", floors[floor]);
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
    const pledge = res.match(new RegExp(types.pledge, "g"))?.length ?? 0;
    const fw_zjgcdy = res.match(new RegExp(types.fw_zjgcdy, "g"))?.length ?? 0;
    const cannotSale =
      res.match(new RegExp(types.cannotSale, "g"))?.length ?? 0;
    const total = sold + forSale + booked + pledge + cannotSale + fw_zjgcdy;
    const summary = { totalSold: 0, total: 0, saleRate: 0 };
    if (floor !== "car" && floor !== "car1") {
      summary.totalSold = sold + booked;
      summary.total = total;
      summary.saleRate = Math.ceil((summary.totalSold / summary.total) * 100);
    }
    const data = {
      sold,
      forSale,
      booked,
      pledge,
      cannotSale,
      fw_zjgcdy,
      summary,
    };
    result[floor] = data;
    floorsCache[floor] = data;
    floorsCacheTime[floor] = Date.now();
  }

  // console.log("result:", result);
  return result;
};

export const getAllProjectName = async () => {
  const formData = new FormData();
  formData.append("currentpage", 1);
  formData.append("pagesize", 200);
  const response = JSON.parse(
    await (
      await axios.post(APIs.listProjectName, formData)
    ).data.Body
  ) as Body;
  projectNames = response.bodylist
    .map((item) =>
      item.XMMC.replace(/\w*\d+\w+\d+[地块]*/, "")
        .replaceAll(/\(([\s\S]*)\)/g, "")
        .replaceAll(/.+·/gi, "")
        .replaceAll(/厦门|子地块|地块|中海项目|·|？|项目/g, "")
        .replace(/\w+\d+-\d+/, "")
        .replaceAll("特房（2019TP01)", "")
        .replaceAll("（X2016P03）", "")
        .replaceAll("（一期）中铁", "")
        .replaceAll(/\s*/g, "")
    )
    .filter((item) => !!item);
  return projectNames;
};

export const saleBot = async (text: string) => {
  if (!projectNames.length) {
    await getAllProjectName();
  }
  console.dir(projectNames, { maxArrayLength: null });
  const project = projectNames.find((item) => text.includes(item));
  if (!project) return {};
  console.log("project", project);
  const tids = await searchFloor(project);
  console.log("tids", tids);
  if (!tids?.length) return {};
  const result = (await Promise.all(tids.map((tid) => getFloors(tid)))).filter(
    (item) => item !== undefined
  );
  if (!result.length) return {};
  const sales = await Promise.all(
    result.map(
      (item) => item && getSaleData(item.floors, item.naids, item.loids)
    )
  );
  return {
    project,
    data: sales.filter((item) => item !== undefined),
  };
};

export const saleBotHandler = async (message: Message) => {
  if (helloFinch(message.text())) return;
  const isRoomMsg = message.room();
  const mentionSelf =
    (await message.mentionSelf()) || message.text().includes("@房产小助手 ");
  if (isRoomMsg && mentionSelf) {
    const searchResult = await saleBot(message.text());
    const { data, project } = searchResult;
    if (!data?.length) {
      message.room()?.say("这个问题我还不懂呢！");
      return;
    }

    let body = "";
    let totalSolds = 0;
    let totalHouses = 0;
    let totalRate = 0;
    let index = 0;
    for (const building of searchResult.data) {
      index += 1;
      if (building === undefined) return;
      Object.keys(building).map((No) => {
        const {
          summary: { total, saleRate, totalSold },
          cannotSale,
          pledge,
          fw_zjgcdy,
          sold,
          booked,
          forSale,
        } = building[No];
        const pledged = pledge + fw_zjgcdy;
        const cannotSaleTemp = !!Number(cannotSale) && `不可售(${cannotSale})`;
        const pledgedTemp = !!pledged && `抵押(${pledged})`;

        body += `\n\n\u00a0\u00a0${No}号楼: 共${total} | 去化${saleRate}%\n已售(${sold}) | 已认购(${booked}) | 未售(${forSale})`;

        if (cannotSaleTemp) {
          body += "\n" + cannotSaleTemp;
        }
        if (pledgedTemp) {
          body += cannotSaleTemp ? " | " + pledgedTemp : "\n" + pledgedTemp;
        }
        totalSolds += totalSold;
        totalHouses += total;
        return;
      });
      searchResult.data.length > 1 &&
        (body += `\n---- 以上为预售证(${index}) ----`);
    }

    totalRate = Math.floor((totalSolds / totalHouses) * 100);
    const today = new Date();
    const time =
      today.toLocaleDateString() +
      " " +
      today.toLocaleTimeString("en-US", { hour12: false });

    const title = `🌟${project}销售数据🌟`;
    const template = `\n\n\u00a0\u00a0${title}\n\n\u00a0\u00a0已售:${totalSolds}\u00a0\u00a0去化:${totalSolds}/${totalHouses}=${totalRate}%
    ____________________________${body}\n\n查询时间: ${time}\n数据来源: 网上房地产`;
    console.log(template);
    await message.room()?.say(template);

    // console.log("id", message.room()?.id);
    // console.log("mentionself", await message.mentionSelf());
    // console.log("mentionList", await message.mentionList());
    // console.log("mentionText", await message.mentionText());
    // console.log("text", message.text());
    // console.log("payload", message.payload);
  }
};
