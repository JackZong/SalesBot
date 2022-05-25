import axios from "axios";
import FormData, { promises } from "form-data";
import { JSDOM } from "jsdom";

import { APIs } from "../lib/api";

export interface Body {
  currentpage: number;
  pagesize: number;
  bodylist: { TRANSACTION_ID: string; YSXKZH: string; XMMC: string }[];
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
};

const folderNameReg = {
  format1: /\d+-\d+号楼住宅/,
  format2: /\w+\d+-\d+号楼\w+梯住宅/,
  format3: /^\w+梯住宅/,
  format4: /.+\d+号住宅/,
};

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

    const id = folderName?.includes("、")
      ? "spec"
      : folderName?.replace("号楼", "");
    if (!id) return;
    const allAreas = Array.from(floor.querySelectorAll("ul>li")).filter(
      (item) => item.innerHTML?.includes("住宅")
    );
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
  console.log("result:", result);
  return result;
};

export async function finch(text: string) {
  const tids = await searchFloor(text);
  console.log("tids", tids);
  if (tids?.length) {
    const result = (
      await Promise.all(tids.map((tid) => getFloors(tid)))
    ).filter((item) => item !== undefined);
    const sales = await Promise.all(
      result.map(
        (item) => item && getSaleData(item.floors, item.naids, item.loids)
      )
    );
    return sales;
  }
}
