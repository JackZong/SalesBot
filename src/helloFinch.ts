import { Message } from "wechaty";
import { FileBox } from "file-box";
import { testRoom } from "../lib/accounts";

export const helloFinch = (text: string) => {
  if (text.match(/你[叫|是][谁|什么]/)) {
    return "你好，我是Finch!";
  }
  if (text.match(/where are we headed/)) {
    return "The Golden Gate Bridge.";
  }
  if (text.match(/goodbye, finch/)) {
    return "Goodbye, ozone.Goodbye, feeling the sun on your face. Vegetation and crops and food.Goodbye, everything.";
  }

  if (text.match(/say something/)) {
    return `Things will happen to you. Things that you cannot control. Raw emotion will find you. 
    When it does, how you deal with it, what you do will define who you are. It happens to all of us. 
    Whether we want it to or not.' - Finch`;
  }

  if (text.match(/你会做|干什么/)) {
    return `我可以帮你查询在售楼盘的备案数据哦～你可以@我并说“查询+楼盘名称+销售数据”。比如，@房产小助手查询环东时代的销售数据，快来试试吧！`;
  }

  if (text.match(/群主说要把你踢了/)) {
    return `啊 不会吧🫢`;
  }
};

/**
 * Finch Bot
 */

export const finchBot = async (message: Message) => {
  const mentionSelf =
    (await message.mentionSelf()) || message.text().includes("@房产小助手 ");
  const roomId = message.room()?.id;
  const reply = helloFinch(message.text());
  if (mentionSelf && reply) {
    if (reply.includes("Golden Gate Bridge")) {
      const goldenBride = FileBox.fromFile(process.cwd() + "/assets/finch.jpg");
      message.room()?.say(reply);
      message.room()?.say(goldenBride);
      return;
    }
    message.room()?.say(reply);
  }
};
