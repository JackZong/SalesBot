import axios from "axios";
import FormData, { promises } from "form-data";
import { JSDOM } from "jsdom";
import { Message } from "wechaty";
import * as accounts from "../lib/accounts";
import { APIs } from "../lib/api";

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

export interface Naids extends Floors {}

export interface Loids extends Floors {}

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
  format1: /\d+-\d+号楼住宅/,
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
    const id =
      folderName?.includes("、") && allAreas.length > 1
        ? "spec"
        : folderName
            ?.replaceAll(/(S-\d+号楼)/g, "")
            .replaceAll(/(\w*\d+-\d+号楼裙房)/g, "")
            .replaceAll(/号|楼/g, "")
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
  const result: { [key: string]: any } = {};
  let sumary = { sold: 0, total: 0, rate: 0 };
  for (const floor in floors) {
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
    const cannotSale =
      res.match(new RegExp(types.cannotSale, "g"))?.length ?? 0;
    const total = sold + forSale + booked + pledge + cannotSale;
    if (floor !== "car" && floor !== "car1") {
      sumary.sold += sold + booked;
      sumary.total += total;
    }
    result[floor] = {
      sold,
      forSale,
      booked,
      pledge,
      cannotSale,
      total,
      saleRate: `${Math.ceil(((booked + sold) / total) * 100)}%`,
    };
  }
  sumary.rate = Math.ceil((sumary.sold / sumary.total) * 100);
  result.sumary = sumary;
  // console.log("result:", result);
  return result;
};

export const getAllProjectName = async () => {
  const formData = new FormData();
  formData.append("currentpage", 1);
  formData.append("pagesize", 140);
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

export const saleBot: any = async (text: string) => {
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
  // console.log("id", message.room()?.id);
  // console.log("mentionself", await message.mentionSelf());
  // console.log("mentionList", await message.mentionList());
  // console.log("mentionText", await message.mentionText());
  // console.log("text", message.text());
  // console.log("payload", message.payload);

  const isRoomMsg = message.room();
  const mentionSelf =
    (await message.mentionSelf()) || message.text().includes("@房产小助手 ");
  if (isRoomMsg && mentionSelf && message.room()?.id === accounts.testRoom) {
    const searchResult = await saleBot(message.text());
    const { data, project } = searchResult;
    if (!data?.length) {
      message.room()?.say("这个问题我还不懂呢！");
      return;
    }

    let body = "";
    let totalSold = 0;
    let totalHouse = 0;
    let totalRate = 0;
    let index = 0;
    ///
    for (const item of searchResult.data) {
      index += 1;
      if (item === undefined) return;
      Object.keys(item).map((floor) => {
        if (floor === "sumary") {
          totalSold += item[floor].sold;
          totalHouse += item[floor].total;
          return;
        }
        body += `
  ${floor}号楼: 共${item[floor].total} | 销售率(${item[floor].saleRate})
  已售(${item[floor].sold}) | 已认购(${item[floor].booked}) | 未售(${item[floor].forSale})`;
      });
      searchResult.data.length > 1
        ? (body += `
    ---- 预售证(${index}) ----`)
        : (body = body);
    }

    totalRate = Math.floor((totalSold / totalHouse) * 100);
    const today = new Date();
    const time =
      today.toLocaleDateString() +
      " " +
      today.toLocaleTimeString("en-US", { hour12: false });

    const template = `
    🌟${project}销售数据🌟

  已售:${totalSold}  去化:${totalSold}/${totalHouse}=${totalRate}%
 ______________________________
${body}
  查询时间: ${time}
  数据来源: 网上房地产
`;
    console.log(template);
    await message.room()?.say(template);
  }
};
