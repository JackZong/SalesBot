const keywords: { [key: string]: any } = {
  "100003134727": ["卖了多少", "环东时代"],
  //  "100003161294": ["樾琴湾卖了多少", "越琴", "樾琴", "樾琴湾二期"],
  "100003161294": ["樾琴湾","越琴湾"],
  "100003209574": ["新玥公馆二期","新玥一期"],
  "100003209575": ["新玥公馆一期","新玥二期"]
};
export const getTidByText = (text: string) => {
  let result = "";
  for (const tid in keywords) {
    for (const keyword of keywords[tid]) {
      if (text.includes(keyword)) {
        result = tid;
        break;
      }
    }
  }
  return result;
};
