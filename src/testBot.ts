import { log } from "wechaty";
import { Mocker } from "wechaty-puppet-mock/dist/esm/src/mock/mocker";

export function SimpleEnvironmentStart(mocker: Mocker): any {
  log.verbose("SimpleEnvironment", "SimpleEnvironmentStart(%s)", mocker);
  mocker.scan("https://github.com/wechaty/wechaty-puppet-mock", 1);

  const finch = mocker.createContact({ name: "Finch", id: "123456" });

  mocker.login(finch);

  const jack = mocker.createContact({ name: "jack" });
  const room = mocker.createRoom({
    memberIdList: [jack.id, finch.id],
    topic: "测试群",
  });
  jack.say("樾熙湾3", [finch]).to(room);
}
