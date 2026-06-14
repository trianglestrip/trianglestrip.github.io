import { apiUrl } from "../config/app.js";

/** 与 node-server cross-categories.data.ts 同步；运行 npm run sync:cross-map 更新 */
const FALLBACK_CATEGORIES = [
  { key: "300", name: "300大作战", aliases: ["300大作战"], sites: { bilibili: { cid: "688", pid: "3" } }, douyu: "2602" },
  { key: "g1887_639", name: "阿尔比恩", aliases: ["阿尔比恩"], sites: { bilibili: { cid: "639", pid: "2" } }, douyu: "1887" },
  { key: "g3406_5801_1010087_555", name: "艾尔登法环", aliases: ["艾尔登法环"], sites: { bilibili: { cid: "555", pid: "6" } }, douyu: "3406", huya: "5801", douyin: "1010087", douyinPid: "1" },
  { key: "g32_1123_535", name: "暗黑破坏神", aliases: ["暗黑破坏神"], sites: { bilibili: { cid: "535", pid: "6" } }, douyu: "32", huya: "1123" },
  { key: "g6385_1010096", name: "暗黑破坏神：不朽", aliases: ["暗黑破坏神：不朽"], huya: "6385", douyin: "1010096", douyinPid: "1" },
  { key: "g3133_7209_1010018_502", name: "暗区突围", aliases: ["暗区突围"], sites: { bilibili: { cid: "502", pid: "3" } }, douyu: "3133", huya: "7209", douyin: "1010018", douyinPid: "1" },
  { key: "g10963_1011124_919", name: "暗区突围：无限", aliases: ["暗区突围：无限"], sites: { bilibili: { cid: "919", pid: "2" } }, huya: "10963", douyin: "1011124", douyinPid: "1" },
  { key: "g3865_849", name: "白荆回廊", aliases: ["白荆回廊"], sites: { bilibili: { cid: "849", pid: "3" } }, douyu: "3865" },
  { key: "g347_1010383_164", name: "堡垒之夜", aliases: ["堡垒之夜"], sites: { bilibili: { cid: "164", pid: "2" } }, douyu: "347", douyin: "1010383", douyinPid: "1" },
  { key: "g3379_7349_1010043_549", name: "崩坏：星穹铁道", aliases: ["崩坏：星穹铁道"], sites: { bilibili: { cid: "549", pid: "3" } }, douyu: "3379", huya: "7349", douyin: "1010043", douyinPid: "1" },
  { key: "g380_1010020_40", name: "崩坏3", aliases: ["崩坏3"], sites: { bilibili: { cid: "40", pid: "3" } }, douyu: "380", douyin: "1010020", douyinPid: "1" },
  { key: "g4112_6147_1010640_385", name: "博德之门3", aliases: ["博德之门3"], sites: { bilibili: { cid: "385", pid: "6" } }, douyu: "4112", huya: "6147", douyin: "1010640", douyinPid: "1" },
  { key: "g10821_1011089", name: "不祥之夜：回魂", aliases: ["不祥之夜：回魂"], huya: "10821", douyin: "1011089", douyinPid: "1" },
  { key: "g177_1797_1010145", name: "部落冲突", aliases: ["部落冲突"], douyu: "177", huya: "1797", douyin: "1010145", douyinPid: "1" },
  { key: "g1898_686", name: "彩虹岛", aliases: ["彩虹岛"], sites: { bilibili: { cid: "686", pid: "2" } }, douyu: "1898" },
  { key: "g4275_2327_601", name: "彩虹六号", aliases: ["彩虹六号"], sites: { bilibili: { cid: "601", pid: "2" } }, douyu: "4275", huya: "2327" },
  { key: "g1476_1011238", name: "超级兔子人", aliases: ["超级兔子人"], douyu: "1476", douyin: "1011238", douyinPid: "1" },
  { key: "g3586_778", name: "尘白禁区", aliases: ["尘白禁区"], sites: { bilibili: { cid: "778", pid: "3" } }, douyu: "3586" },
  { key: "cf", name: "穿越火线", aliases: ["穿越火线", "cf"], sites: { bilibili: { cid: "88", pid: "2" } }, douyu: "4", huya: "4", douyin: "1010037", douyinPid: "1" },
  { key: "g187_983_695", name: "传奇", aliases: ["传奇"], sites: { bilibili: { cid: "695", pid: "2" } }, douyu: "187", huya: "983" },
  { key: "g1962_227", name: "刺客信条", aliases: ["刺客信条"], sites: { bilibili: { cid: "227", pid: "6" } }, huya: "1962" },
  { key: "g1010143_652", name: "大话西游", aliases: ["大话西游"], sites: { bilibili: { cid: "652", pid: "2" } }, douyin: "1010143", douyinPid: "1" },
  { key: "g8239_1010287", name: "大话西游：归来", aliases: ["大话西游：归来"], huya: "8239", douyin: "1010287", douyinPid: "1" },
  { key: "g2013_1010205", name: "大话西游2", aliases: ["大话西游2"], douyu: "2013", douyin: "1010205", douyinPid: "1" },
  { key: "group-danji", name: "单机", aliases: ["单机", "单机热游", "单机游戏"], kind: "group", sites: { bilibili: { groupId: "6" } }, douyuGroup: "15", huyaTabId: "2", huyaGroup: "100002", douyinGroupIds: ["3"], douyinPartitions: [{ cid: "1011359", pid: "1" }, { cid: "1010324", pid: "1" }] },
  { key: "g3358_6909_1010011_571", name: "蛋仔派对", aliases: ["蛋仔派对"], sites: { bilibili: { cid: "571", pid: "3" } }, douyu: "3358", huya: "6909", douyin: "1010011", douyinPid: "1" },
  { key: "g389_3641_341", name: "盗贼之海", aliases: ["盗贼之海"], sites: { bilibili: { cid: "341", pid: "6" } }, douyu: "389", huya: "3641" },
  { key: "g1701_1010099", name: "地铁跑酷", aliases: ["地铁跑酷"], huya: "1701", douyin: "1010099", douyinPid: "1" },
  { key: "dnf", name: "DNF", aliases: ["DNF", "dnf", "地下城与勇士"], sites: { bilibili: { cid: "78", pid: "2" } }, douyu: "40", huya: "2", douyin: "1010092", douyinPid: "1" },
  { key: "g4835_548", name: "帝国时代4", aliases: ["帝国时代4"], sites: { bilibili: { cid: "548", pid: "6" } }, huya: "4835" },
  { key: "g2618_784", name: "第七史诗", aliases: ["第七史诗"], sites: { bilibili: { cid: "784", pid: "3" } }, douyu: "2618" },
  { key: "g356_3115_1010041_163", name: "第五人格", aliases: ["第五人格"], sites: { bilibili: { cid: "163", pid: "3" } }, douyu: "356", huya: "3115", douyin: "1010041", douyinPid: "1" },
  { key: "g3822_909", name: "第一后裔", aliases: ["第一后裔"], sites: { bilibili: { cid: "909", pid: "2" } }, douyu: "3822" },
  { key: "g3352_1010007", name: "巅峰极速", aliases: ["巅峰极速"], douyu: "3352", douyin: "1010007", douyinPid: "1" },
  { key: "g1137_2502", name: "巅峰战舰", aliases: ["巅峰战舰"], douyu: "1137", huya: "2502" },
  { key: "g484_1010142", name: "都市：天际线", aliases: ["都市：天际线"], douyu: "484", douyin: "1010142", douyinPid: "1" },
  { key: "g2128_6381", name: "斗罗大陆：武魂觉醒", aliases: ["斗罗大陆：武魂觉醒"], douyu: "2128", huya: "6381" },
  { key: "g3823_283", name: "独立游戏", aliases: ["独立游戏"], sites: { bilibili: { cid: "283", pid: "6" } }, huya: "3823" },
  { key: "g859_6039", name: "对马岛之魂", aliases: ["对马岛之魂"], douyu: "859", huya: "6039" },
  { key: "g5495_1011048", name: "俄罗斯钓鱼4", aliases: ["俄罗斯钓鱼4"], huya: "5495", douyin: "1011048", douyinPid: "1" },
  { key: "g3877_993", name: "鹅鸭杀手游", aliases: ["鹅鸭杀手游"], sites: { bilibili: { cid: "993", pid: "3" } }, douyu: "3877" },
  { key: "g174_2633", name: "二次元", aliases: ["二次元"], douyu: "174", huya: "2633" },
  { key: "g254_100091", name: "二次元手游", aliases: ["二次元手游"], douyu: "254", huya: "100091" },
  { key: "online", name: "反恐精英Online", aliases: ["反恐精英Online"], sites: { bilibili: { cid: "629", pid: "2" } }, douyu: "66", huya: "1918" },
  { key: "g1997_1010100_295", name: "方舟", aliases: ["方舟"], sites: { bilibili: { cid: "295", pid: "6" } }, huya: "1997", douyin: "1010100", douyinPid: "1" },
  { key: "g35_114", name: "风暴英雄", aliases: ["风暴英雄"], sites: { bilibili: { cid: "114", pid: "2" } }, douyu: "35" },
  { key: "g4022_1010198_783", name: "高能英雄", aliases: ["高能英雄"], sites: { bilibili: { cid: "783", pid: "3" } }, douyu: "4022", douyin: "1010198", douyinPid: "1" },
  { key: "g29_100299_433", name: "格斗游戏", aliases: ["格斗游戏"], sites: { bilibili: { cid: "433", pid: "6" } }, douyu: "29", huya: "100299" },
  { key: "g2068_578", name: "怪物猎人", aliases: ["怪物猎人"], sites: { bilibili: { cid: "578", pid: "6" } }, douyu: "2068" },
  { key: "g4276_69017_1011304", name: "怪物猎人：荒野", aliases: ["怪物猎人：荒野"], douyu: "4276", huya: "69017", douyin: "1011304", douyinPid: "1" },
  { key: "g6479_1010420", name: "怪物猎人：崛起", aliases: ["怪物猎人：崛起"], huya: "6479", douyin: "1010420", douyinPid: "1" },
  { key: "g1132_1010035_687", name: "光遇", aliases: ["光遇"], sites: { bilibili: { cid: "687", pid: "3" } }, douyu: "1132", douyin: "1010035", douyinPid: "1" },
  { key: "g4251_924", name: "归龙潮", aliases: ["归龙潮"], sites: { bilibili: { cid: "924", pid: "3" } }, douyu: "4251" },
  { key: "g1192_5835_1010054_474", name: "哈利波特：魔法觉醒", aliases: ["哈利波特：魔法觉醒"], sites: { bilibili: { cid: "474", pid: "3" } }, douyu: "1192", huya: "5835", douyin: "1010054", douyinPid: "1" },
  { key: "g1991_1010385", name: "海岛奇兵", aliases: ["海岛奇兵"], douyu: "1991", douyin: "1010385", douyinPid: "1" },
  { key: "g1883_1010231_504", name: "航海王热血航线", aliases: ["航海王热血航线"], sites: { bilibili: { cid: "504", pid: "3" } }, douyu: "1883", douyin: "1010231", douyinPid: "1" },
  { key: "hpjy", name: "和平精英", aliases: ["和平精英", "绝地求生", "pubg", "吃鸡"], sites: { bilibili: { cid: "256", pid: "3" } }, douyu: "270", huya: "3203", douyin: "1010032", douyinPid: "1" },
  { key: "g4295_71827", name: "和平精英模拟器", aliases: ["和平精英模拟器"], douyu: "4295", huya: "71827" },
  { key: "g2282_1877_632", name: "黑色沙漠", aliases: ["黑色沙漠"], sites: { bilibili: { cid: "632", pid: "2" } }, douyu: "2282", huya: "1877" },
  { key: "g2075_6111_1010358_804", name: "黑神话：悟空", aliases: ["黑神话：悟空"], sites: { bilibili: { cid: "804", pid: "6" } }, douyu: "2075", huya: "6111", douyin: "1010358", douyinPid: "1" },
  { key: "g1010102_693", name: "红色警戒2", aliases: ["红色警戒2"], sites: { bilibili: { cid: "693", pid: "6" } }, douyin: "1010102", douyinPid: "1" },
  { key: "g4201_1053", name: "红色沙漠", aliases: ["红色沙漠"], sites: { bilibili: { cid: "1053", pid: "6" } }, douyu: "4201" },
  { key: "g722_507", name: "胡闹厨房", aliases: ["胡闹厨房"], sites: { bilibili: { cid: "507", pid: "6" } }, douyu: "722" },
  { key: "g124_2165", name: "户外", aliases: ["户外"], douyu: "124", huya: "2165" },
  { key: "g26_100125_237", name: "怀旧游戏", aliases: ["怀旧游戏"], sites: { bilibili: { cid: "237", pid: "6" } }, douyu: "26", huya: "100125" },
  { key: "g416_1749_1010062_719", name: "欢乐斗地主", aliases: ["欢乐斗地主"], sites: { bilibili: { cid: "719", pid: "3" } }, douyu: "416", huya: "1749", douyin: "1010062", douyinPid: "1" },
  { key: "g451_1751", name: "欢乐麻将", aliases: ["欢乐麻将"], douyu: "451", huya: "1751" },
  { key: "g721_4865", name: "环世界", aliases: ["环世界"], douyu: "721", huya: "4865" },
  { key: "g3935_9961_1010981_866", name: "幻兽帕鲁", aliases: ["幻兽帕鲁"], sites: { bilibili: { cid: "866", pid: "6" } }, douyu: "3935", huya: "9961", douyin: "1010981", douyinPid: "1" },
  { key: "g2263_6437_550", name: "幻塔", aliases: ["幻塔"], sites: { bilibili: { cid: "550", pid: "3" } }, douyu: "2263", huya: "6437" },
  { key: "g1010363_226", name: "荒野大镖客2", aliases: ["荒野大镖客2"], sites: { bilibili: { cid: "226", pid: "6" } }, douyin: "1010363", douyinPid: "1" },
  { key: "g625_4613_1010138_469", name: "荒野乱斗", aliases: ["荒野乱斗"], sites: { bilibili: { cid: "469", pid: "3" } }, douyu: "625", huya: "4613", douyin: "1010138", douyinPid: "1" },
  { key: "g190_2439_1010230", name: "皇室战争", aliases: ["皇室战争"], douyu: "190", huya: "2439", douyin: "1010230", douyinPid: "1" },
  { key: "g2925_1010241", name: "火炬之光：无限", aliases: ["火炬之光：无限"], douyu: "2925", douyin: "1010241", douyinPid: "1" },
  { key: "g2429_1010042_292", name: "火影忍者手游", aliases: ["火影忍者手游"], sites: { bilibili: { cid: "292", pid: "3" } }, huya: "2429", douyin: "1010042", douyinPid: "1" },
  { key: "g23_74_1010335_218", name: "饥荒", aliases: ["饥荒"], sites: { bilibili: { cid: "218", pid: "6" } }, douyu: "23", huya: "74", douyin: "1010335", douyinPid: "1" },
  { key: "2", name: "激战2", aliases: ["激战2"], sites: { bilibili: { cid: "607", pid: "2" } }, douyu: "15", douyin: "1010405", douyinPid: "1" },
  { key: "g9421_1010686_852", name: "极品飞车：集结", aliases: ["极品飞车：集结"], sites: { bilibili: { cid: "852", pid: "3" } }, huya: "9421", douyin: "1010686", douyinPid: "1" },
  { key: "5", name: "极限竞速：地平线5", aliases: ["极限竞速：地平线5"], douyu: "3468", douyin: "1010429", douyinPid: "1" },
  { key: "g13_897_505", name: "剑灵", aliases: ["剑灵"], sites: { bilibili: { cid: "505", pid: "2" } }, douyu: "13", huya: "897" },
  { key: "3", name: "剑网3", aliases: ["剑网3"], sites: { bilibili: { cid: "82", pid: "2" } }, douyu: "65", huya: "900", douyin: "1010249", douyinPid: "1" },
  { key: "g3074_499", name: "剑网3缘起", aliases: ["剑网3缘起"], sites: { bilibili: { cid: "499", pid: "2" } }, douyu: "3074" },
  { key: "g10567_1011081_988", name: "剑星", aliases: ["剑星"], sites: { bilibili: { cid: "988", pid: "6" } }, huya: "10567", douyin: "1011081", douyinPid: "1" },
  { key: "g1798_5999", name: "街机游戏", aliases: ["街机游戏"], douyu: "1798", huya: "5999" },
  { key: "g155_206_649", name: "街头篮球", aliases: ["街头篮球"], sites: { bilibili: { cid: "649", pid: "2" } }, douyu: "155", huya: "206" },
  { key: "g10961_1010260_915", name: "解限机", aliases: ["解限机"], sites: { bilibili: { cid: "915", pid: "2" } }, huya: "10961", douyin: "1010260", douyinPid: "1" },
  { key: "g68167_941", name: "界外狂潮", aliases: ["界外狂潮"], sites: { bilibili: { cid: "941", pid: "2" } }, huya: "68167" },
  { key: "g2556_7185_1010055_514", name: "金铲铲之战", aliases: ["金铲铲之战"], sites: { bilibili: { cid: "514", pid: "3" } }, douyu: "2556", huya: "7185", douyin: "1010055", douyinPid: "1" },
  { key: "g412_2420", name: "劲舞团", aliases: ["劲舞团"], douyu: "412", huya: "2420" },
  { key: "g6065_1010247", name: "禁闭求生", aliases: ["禁闭求生"], huya: "6065", douyin: "1010247", douyinPid: "1" },
  { key: "g1010044_777", name: "晶核", aliases: ["晶核"], sites: { bilibili: { cid: "777", pid: "3" } }, douyin: "1010044", douyinPid: "1" },
  { key: "g4346_78211_1061", name: "竞拍之王", aliases: ["竞拍之王"], sites: { bilibili: { cid: "1061", pid: "6" } }, douyu: "4346", huya: "78211" },
  { key: "g7537_1010292_947", name: "决胜巅峰", aliases: ["决胜巅峰"], sites: { bilibili: { cid: "947", pid: "3" } }, huya: "7537", douyin: "1010292", douyinPid: "1" },
  { key: "g1010057_140", name: "决战！平安京", aliases: ["决战！平安京"], sites: { bilibili: { cid: "140", pid: "3" } }, douyin: "1010057", douyinPid: "1" },
  { key: "g1011000_875", name: "绝地潜兵2", aliases: ["绝地潜兵2"], sites: { bilibili: { cid: "875", pid: "6" } }, douyin: "1011000", douyinPid: "1" },
  { key: "g3671_7711_1010155_662", name: "绝区零", aliases: ["绝区零"], sites: { bilibili: { cid: "662", pid: "3" } }, douyu: "3671", huya: "7711", douyin: "1010155", douyinPid: "1" },
  { key: "g255_100133", name: "军事游戏", aliases: ["军事游戏"], douyu: "255", huya: "100133" },
  { key: "g3010_9073_1010168_782", name: "卡拉彼丘", aliases: ["卡拉彼丘"], sites: { bilibili: { cid: "782", pid: "2" } }, douyu: "3010", huya: "9073", douyin: "1010168", douyinPid: "1" },
  { key: "g1010360_1009", name: "空洞骑士：丝之歌", aliases: ["空洞骑士：丝之歌"], sites: { bilibili: { cid: "1009", pid: "6" } }, douyin: "1010360", douyinPid: "1" },
  { key: "g760_9453_276", name: "恐怖游戏", aliases: ["恐怖游戏"], sites: { bilibili: { cid: "276", pid: "6" } }, douyu: "760", huya: "9453" },
  { key: "g1910_6205_387", name: "恐鬼症", aliases: ["恐鬼症"], sites: { bilibili: { cid: "387", pid: "6" } }, douyu: "1910", huya: "6205" },
  { key: "g2046_6679", name: "恐惧之间", aliases: ["恐惧之间"], douyu: "2046", huya: "6679" },
  { key: "g260_2785_1010313_41", name: "狼人杀", aliases: ["狼人杀"], sites: { bilibili: { cid: "41", pid: "3" } }, douyu: "260", huya: "2785", douyin: "1010313", douyinPid: "1" },
  { key: "g1819_6131_1010029_479", name: "黎明觉醒：生机", aliases: ["黎明觉醒：生机"], sites: { bilibili: { cid: "479", pid: "3" } }, douyu: "1819", huya: "6131", douyin: "1010029", douyinPid: "1" },
  { key: "g1026_1010441", name: "猎人：荒野的召唤", aliases: ["猎人：荒野的召唤"], douyu: "1026", douyin: "1010441", douyinPid: "1" },
  { key: "g1971_2282", name: "领地人生", aliases: ["领地人生"], douyu: "1971", huya: "2282" },
  { key: "g847_2772", name: "流放者柯南", aliases: ["流放者柯南"], douyu: "847", huya: "2772" },
  { key: "g427_1010411_551", name: "流放之路", aliases: ["流放之路"], sites: { bilibili: { cid: "551", pid: "2" } }, huya: "427", douyin: "1010411", douyinPid: "1" },
  { key: "g4050_1011359", name: "流放之路2", aliases: ["流放之路2"], douyu: "4050", douyin: "1011359", douyinPid: "1" },
  { key: "g106_112", name: "龙之谷", aliases: ["龙之谷"], sites: { bilibili: { cid: "112", pid: "2" } }, douyu: "106" },
  { key: "hs", name: "炉石传说", aliases: ["炉石传说", "炉石"], sites: { bilibili: { cid: "91", pid: "2" } }, douyu: "393", huya: "393", douyin: "1010397", douyinPid: "1" },
  { key: "g376_2691_1010021_807", name: "率土之滨", aliases: ["率土之滨"], sites: { bilibili: { cid: "807", pid: "3" } }, douyu: "376", huya: "2691", douyin: "1010021", douyinPid: "1" },
  { key: "g5771_1010523", name: "罗布乐思", aliases: ["罗布乐思"], huya: "5771", douyin: "1010523", douyinPid: "1" },
  { key: "g3704_2430", name: "罗马复兴", aliases: ["罗马复兴"], douyu: "3704", huya: "2430" },
  { key: "g4249_2864_1010203_669", name: "洛克王国", aliases: ["洛克王国"], sites: { bilibili: { cid: "669", pid: "2" } }, douyu: "4249", huya: "2864", douyin: "1010203", douyinPid: "1" },
  { key: "g11043_958", name: "洛克王国：世界", aliases: ["洛克王国：世界"], sites: { bilibili: { cid: "958", pid: "3" } }, huya: "11043" },
  { key: "g1907_599", name: "洛奇英雄传", aliases: ["洛奇英雄传"], sites: { bilibili: { cid: "599", pid: "2" } }, douyu: "1907" },
  { key: "g994_2303", name: "漫漫长夜", aliases: ["漫漫长夜"], douyu: "994", huya: "2303" },
  { key: "g4252_1011240_922", name: "漫威争锋", aliases: ["漫威争锋"], sites: { bilibili: { cid: "922", pid: "2" } }, douyu: "4252", douyin: "1011240", douyinPid: "1" },
  { key: "g524_1010327", name: "猫和老鼠", aliases: ["猫和老鼠"], douyu: "524", douyin: "1010327", douyinPid: "1" },
  { key: "g1588_2243_574", name: "冒险岛", aliases: ["冒险岛"], sites: { bilibili: { cid: "574", pid: "2" } }, douyu: "1588", huya: "2243" },
  { key: "g4016_8005_1010311", name: "冒险岛：枫之传说", aliases: ["冒险岛：枫之传说"], douyu: "4016", huya: "8005", douyin: "1010311", douyinPid: "1" },
  { key: "g1843_6165_1010038_384", name: "猛兽派对", aliases: ["猛兽派对"], sites: { bilibili: { cid: "384", pid: "6" } }, douyu: "1843", huya: "6165", douyin: "1010038", douyinPid: "1" },
  { key: "g500_1010394_178", name: "梦幻模拟战", aliases: ["梦幻模拟战"], sites: { bilibili: { cid: "178", pid: "3" } }, douyu: "500", douyin: "1010394", douyinPid: "1" },
  { key: "g69_1010053", name: "梦幻西游", aliases: ["梦幻西游"], douyu: "69", douyin: "1010053", douyinPid: "1" },
  { key: "g1010051_342", name: "梦幻西游手游", aliases: ["梦幻西游手游"], sites: { bilibili: { cid: "342", pid: "3" } }, douyin: "1010051", douyinPid: "1" },
  { key: "g1583_1010315", name: "梦幻新诛仙", aliases: ["梦幻新诛仙"], douyu: "1583", douyin: "1010315", douyinPid: "1" },
  { key: "g489_710", name: "梦三国", aliases: ["梦三国"], sites: { bilibili: { cid: "710", pid: "2" } }, huya: "489" },
  { key: "g273_2683_1010046", name: "迷你世界", aliases: ["迷你世界"], douyu: "273", huya: "2683", douyin: "1010046", douyinPid: "1" },
  { key: "g74371_1041", name: "名将杀", aliases: ["名将杀"], sites: { bilibili: { cid: "1041", pid: "3" } }, huya: "74371" },
  { key: "g3972_7363_1001", name: "明末：渊虚之羽", aliases: ["明末：渊虚之羽"], sites: { bilibili: { cid: "1001", pid: "6" } }, douyu: "3972", huya: "7363" },
  { key: "g531_4925_1010013_255", name: "明日方舟", aliases: ["明日方舟"], sites: { bilibili: { cid: "255", pid: "3" } }, douyu: "531", huya: "4925", douyin: "1010013", douyinPid: "1" },
  { key: "g3587_8363_1010190_848", name: "明日方舟：终末地", aliases: ["明日方舟：终末地"], sites: { bilibili: { cid: "848", pid: "3" } }, douyu: "3587", huya: "8363", douyin: "1010190", douyinPid: "1" },
  { key: "g430_3483_1010006_189", name: "明日之后", aliases: ["明日之后"], sites: { bilibili: { cid: "189", pid: "3" } }, douyu: "430", huya: "3483", douyin: "1010006", douyinPid: "1" },
  { key: "g3696_8037_1010159_874", name: "鸣潮", aliases: ["鸣潮"], sites: { bilibili: { cid: "874", pid: "3" } }, douyu: "3696", huya: "8037", douyin: "1010159", douyinPid: "1" },
  { key: "g286_2942_1010422_277", name: "命运2", aliases: ["命运2"], sites: { bilibili: { cid: "277", pid: "6" } }, douyu: "286", huya: "2942", douyin: "1010422", douyinPid: "1" },
  { key: "g73095_998", name: "命运扳机", aliases: ["命运扳机"], sites: { bilibili: { cid: "998", pid: "2" } }, huya: "73095" },
  { key: "g3528_3058_1010233_590", name: "命运方舟", aliases: ["命运方舟"], sites: { bilibili: { cid: "590", pid: "2" } }, douyu: "3528", huya: "3058", douyin: "1010233", douyinPid: "1" },
  { key: "g3692_2891", name: "魔力宝贝", aliases: ["魔力宝贝"], douyu: "3692", huya: "2891" },
  { key: "g5_8_1010150_83", name: "魔兽世界", aliases: ["魔兽世界"], sites: { bilibili: { cid: "83", pid: "2" } }, douyu: "5", huya: "8", douyin: "1010150", douyinPid: "1" },
  { key: "g4615_1010350_181", name: "魔兽争霸3", aliases: ["魔兽争霸3"], sites: { bilibili: { cid: "181", pid: "2" } }, huya: "4615", douyin: "1010350", douyinPid: "1" },
  { key: "g434_2952_1010364", name: "逆水寒", aliases: ["逆水寒"], douyu: "434", huya: "2952", douyin: "1010364", douyinPid: "1" },
  { key: "g2446_7725_1010083_771", name: "逆水寒手游", aliases: ["逆水寒手游"], sites: { bilibili: { cid: "771", pid: "3" } }, douyu: "2446", huya: "7725", douyin: "1010083", douyinPid: "1" },
  { key: "g46_135_1010132_487", name: "逆战", aliases: ["逆战"], sites: { bilibili: { cid: "487", pid: "2" } }, douyu: "46", huya: "135", douyin: "1010132", douyinPid: "1" },
  { key: "g7575_1036", name: "逆战：未来", aliases: ["逆战：未来"], sites: { bilibili: { cid: "1036", pid: "2" } }, huya: "7575" },
  { key: "g3534_1010472", name: "暖雪", aliases: ["暖雪"], douyu: "3534", douyin: "1010472", douyinPid: "1" },
  { key: "g90_162_1010331_664", name: "跑跑卡丁车", aliases: ["跑跑卡丁车"], sites: { bilibili: { cid: "664", pid: "2" } }, douyu: "90", huya: "162", douyin: "1010331", douyinPid: "1" },
  { key: "g2620_265", name: "跑跑卡丁车手游", aliases: ["跑跑卡丁车手游"], sites: { bilibili: { cid: "265", pid: "3" } }, huya: "2620" },
  { key: "g633_440", name: "泡泡堂", aliases: ["泡泡堂"], douyu: "633", huya: "440" },
  { key: "g1010320_812", name: "匹诺曹的谎言", aliases: ["匹诺曹的谎言"], sites: { bilibili: { cid: "812", pid: "6" } }, douyin: "1010320", douyinPid: "1" },
  { key: "g4188_9995_1010558_857", name: "七日世界", aliases: ["七日世界"], sites: { bilibili: { cid: "857", pid: "2" } }, douyu: "4188", huya: "9995", douyin: "1010558", douyinPid: "1" },
  { key: "g3069_235", name: "其他单机", aliases: ["其他单机"], sites: { bilibili: { cid: "235", pid: "6" } }, huya: "3069" },
  { key: "g491_326", name: "骑马与砍杀", aliases: ["骑马与砍杀"], sites: { bilibili: { cid: "326", pid: "6" } }, douyu: "491" },
  { key: "g4069_1010626", name: "潜水员戴夫", aliases: ["潜水员戴夫"], douyu: "4069", douyin: "1010626", douyinPid: "1" },
  { key: "g496_251", name: "枪神纪", aliases: ["枪神纪"], sites: { bilibili: { cid: "251", pid: "2" } }, huya: "496" },
  { key: "g192_2411_1010010", name: "球球大作战", aliases: ["球球大作战"], douyu: "192", huya: "2411", douyin: "1010010", douyinPid: "1" },
  { key: "g3956_5023_1010199_243", name: "全境封锁2", aliases: ["全境封锁2"], sites: { bilibili: { cid: "243", pid: "6" } }, douyu: "3956", huya: "5023", douyin: "1010199", douyinPid: "1" },
  { key: "g2231_3521_257", name: "全面战争", aliases: ["全面战争"], sites: { bilibili: { cid: "257", pid: "6" } }, douyu: "2231", huya: "3521" },
  { key: "g4043_845", name: "全民街篮", aliases: ["全民街篮"], sites: { bilibili: { cid: "845", pid: "2" } }, douyu: "4043" },
  { key: "g3844_1010180", name: "全明星街球派对", aliases: ["全明星街球派对"], douyu: "3844", douyin: "1010180", douyinPid: "1" },
  { key: "g702_2884", name: "缺氧", aliases: ["缺氧"], douyu: "702", huya: "2884" },
  { key: "g7107_803", name: "雀魂麻将", aliases: ["雀魂麻将"], sites: { bilibili: { cid: "803", pid: "6" } }, huya: "7107" },
  { key: "g87_1010895", name: "群雄逐鹿", aliases: ["群雄逐鹿"], douyu: "87", douyin: "1010895", douyinPid: "1" },
  { key: "g5429_677", name: "人间地狱", aliases: ["人间地狱"], sites: { bilibili: { cid: "677", pid: "2" } }, huya: "5429" },
  { key: "g701_1010774", name: "仁王", aliases: ["仁王"], douyu: "701", douyin: "1010774", douyinPid: "1" },
  { key: "g2081_5795", name: "仁王2", aliases: ["仁王2"], douyu: "2081", huya: "5795" },
  { key: "g566_4041_1010129_203", name: "忍者必须死3", aliases: ["忍者必须死3"], sites: { bilibili: { cid: "203", pid: "3" } }, douyu: "566", huya: "4041", douyin: "1010129", douyinPid: "1" },
  { key: "g397_2369", name: "忍者村大战2", aliases: ["忍者村大战2"], douyu: "397", huya: "2369" },
  { key: "g3793_7883_1010082", name: "塞尔达传说：王国之泪", aliases: ["塞尔达传说：王国之泪"], douyu: "3793", huya: "7883", douyin: "1010082", douyinPid: "1" },
  { key: "2077", name: "赛博朋克2077", aliases: ["赛博朋克2077"], sites: { bilibili: { cid: "402", pid: "6" } }, douyu: "836", douyin: "1010128", douyinPid: "1" },
  { key: "g1010521_667", name: "赛尔号", aliases: ["赛尔号"], sites: { bilibili: { cid: "667", pid: "2" } }, douyin: "1010521", douyinPid: "1" },
  { key: "g4205_871", name: "三国：谋定天下", aliases: ["三国：谋定天下"], sites: { bilibili: { cid: "871", pid: "3" } }, douyu: "4205" },
  { key: "g14_1669_1010061_81", name: "三国杀", aliases: ["三国杀"], sites: { bilibili: { cid: "81", pid: "2" } }, douyu: "14", huya: "1669", douyin: "1010061", douyinPid: "1" },
  { key: "g657_352", name: "三国杀移动版", aliases: ["三国杀移动版"], sites: { bilibili: { cid: "352", pid: "3" } }, douyu: "657" },
  { key: "g1795_6047", name: "三国战纪", aliases: ["三国战纪"], douyu: "1795", huya: "6047" },
  { key: "g2085_1010514", name: "三国志14", aliases: ["三国志14"], douyu: "2085", douyin: "1010514", douyinPid: "1" },
  { key: "g1581_5619", name: "三国志战略版", aliases: ["三国志战略版"], douyu: "1581", huya: "5619" },
  { key: "g4133_9449_1011032_878", name: "三角洲行动", aliases: ["三角洲行动"], sites: { bilibili: { cid: "878", pid: "2" } }, douyu: "4133", huya: "9449", douyin: "1011032", douyinPid: "1" },
  { key: "g3669_7943_1010783", name: "森林之子", aliases: ["森林之子"], douyu: "3669", huya: "7943", douyin: "1010783", douyinPid: "1" },
  { key: "g390_3601", name: "杀戮尖塔", aliases: ["杀戮尖塔"], douyu: "390", huya: "3601" },
  { key: "g2458_39", name: "少女前线", aliases: ["少女前线"], sites: { bilibili: { cid: "39", pid: "3" } }, douyu: "2458" },
  { key: "g2647_832", name: "少女前线2：追放", aliases: ["少女前线2：追放"], sites: { bilibili: { cid: "832", pid: "3" } }, douyu: "2647" },
  { key: "4", name: "神武4电脑版", aliases: ["神武4电脑版"], douyu: "1136", huya: "3227" },
  { key: "g1680_8013", name: "生化危机4重制版", aliases: ["生化危机4重制版"], douyu: "1680", huya: "8013" },
  { key: "g2471_1010409", name: "生死狙击", aliases: ["生死狙击"], huya: "2471", douyin: "1010409", douyinPid: "1" },
  { key: "g1781_1010068_575", name: "生死狙击2", aliases: ["生死狙击2"], sites: { bilibili: { cid: "575", pid: "2" } }, douyu: "1781", douyin: "1010068", douyinPid: "1" },
  { key: "g4319_1005", name: "盛世天下", aliases: ["盛世天下"], sites: { bilibili: { cid: "1005", pid: "6" } }, douyu: "4319" },
  { key: "rust", name: "失控进化-RUST", aliases: ["失控进化-RUST"], douyu: "4288", huya: "70953" },
  { key: "g1010675_643", name: "时空猎人3", aliases: ["时空猎人3"], sites: { bilibili: { cid: "643", pid: "3" } }, douyin: "1010675", douyinPid: "1" },
  { key: "g474_3741_1010030", name: "实况足球", aliases: ["实况足球"], douyu: "474", huya: "3741", douyin: "1010030", douyinPid: "1" },
  { key: "g472_1010329", name: "使命召唤", aliases: ["使命召唤"], douyu: "472", douyin: "1010329", douyinPid: "1" },
  { key: "g1010080_386", name: "使命召唤手游", aliases: ["使命召唤手游"], sites: { bilibili: { cid: "386", pid: "3" } }, douyin: "1010080", douyinPid: "1" },
  { key: "group-shouyou", name: "手游", aliases: ["手游", "手游休闲", "角色扮演", "策略卡牌", "棋牌游戏"], kind: "group", sites: { bilibili: { groupId: "3" } }, douyuGroup: "9", huyaTabId: "3", huyaGroup: "100004", douyinGroupIds: ["4", "6", "7"], douyinPartitions: [{ cid: "1010063", pid: "1" }, { cid: "1010040", pid: "1" }, { cid: "1010053", pid: "1" }, { cid: "1010271", pid: "1" }, { cid: "1010324", pid: "1" }, { cid: "1010043", pid: "1" }] },
  { key: "g148_2174_1010339_87", name: "守望先锋", aliases: ["守望先锋"], sites: { bilibili: { cid: "87", pid: "2" } }, douyu: "148", huya: "2174", douyin: "1010339", douyinPid: "1" },
  { key: "g6169_1010381", name: "曙光英雄", aliases: ["曙光英雄"], huya: "6169", douyin: "1010381", douyinPid: "1" },
  { key: "g2087_6737_446", name: "双人成行", aliases: ["双人成行"], sites: { bilibili: { cid: "446", pid: "6" } }, douyu: "2087", huya: "6737" },
  { key: "g4283_70355_1010436_951", name: "双影奇境", aliases: ["双影奇境"], sites: { bilibili: { cid: "951", pid: "6" } }, douyu: "4283", huya: "70355", douyin: "1010436", douyinPid: "1" },
  { key: "g1644_5995", name: "四海兄弟", aliases: ["四海兄弟"], douyu: "1644", huya: "5995" },
  { key: "g4357_224", name: "太吾绘卷", aliases: ["太吾绘卷"], sites: { bilibili: { cid: "224", pid: "6" } }, huya: "4357" },
  { key: "g1045_1010396_593", name: "泰拉瑞亚", aliases: ["泰拉瑞亚"], sites: { bilibili: { cid: "593", pid: "6" } }, douyu: "1045", douyin: "1010396", douyinPid: "1" },
  { key: "g142_802_1010340_115", name: "坦克世界", aliases: ["坦克世界"], sites: { bilibili: { cid: "115", pid: "2" } }, douyu: "142", huya: "802", douyin: "1010340", douyinPid: "1" },
  { key: "g1778_357", name: "糖豆人", aliases: ["糖豆人"], sites: { bilibili: { cid: "357", pid: "6" } }, douyu: "1778" },
  { key: "g1024_3493_1010104_252", name: "逃离塔科夫", aliases: ["逃离塔科夫"], sites: { bilibili: { cid: "252", pid: "2" } }, douyu: "1024", huya: "3493", douyin: "1010104", douyinPid: "1" },
  { key: "g4137_1010058", name: "逃跑吧！少年", aliases: ["逃跑吧！少年"], huya: "4137", douyin: "1010058", douyinPid: "1" },
  { key: "g517_100135_500", name: "体育游戏", aliases: ["体育游戏"], sites: { bilibili: { cid: "500", pid: "6" } }, douyu: "517", huya: "100135" },
  { key: "g1593_448", name: "天地劫：幽城再临", aliases: ["天地劫：幽城再临"], sites: { bilibili: { cid: "448", pid: "3" } }, douyu: "1593" },
  { key: "g4279_69105", name: "天国：拯救2", aliases: ["天国：拯救2"], douyu: "4279", huya: "69105" },
  { key: "g433_4997_1010060", name: "天天象棋", aliases: ["天天象棋"], douyu: "433", huya: "4997", douyin: "1010060", douyinPid: "1" },
  { key: "g59_1219_1010119_596", name: "天涯明月刀", aliases: ["天涯明月刀"], sites: { bilibili: { cid: "596", pid: "2" } }, douyu: "59", huya: "1219", douyin: "1010119", douyinPid: "1" },
  { key: "g669_2765_691", name: "铁甲雄兵", aliases: ["铁甲雄兵"], sites: { bilibili: { cid: "691", pid: "2" } }, douyu: "669", huya: "2765" },
  { key: "g6463_1010524", name: "王牌竞速", aliases: ["王牌竞速"], huya: "6463", douyin: "1010524", douyinPid: "1" },
  { key: "g1056_5699", name: "王者模拟战", aliases: ["王者模拟战"], douyu: "1056", huya: "5699" },
  { key: "wzry", name: "王者荣耀", aliases: ["王者荣耀", "王者"], sites: { bilibili: { cid: "35", pid: "3" } }, douyu: "181", huya: "2336", douyin: "1010045", douyinPid: "1" },
  { key: "g4298_71519_1033", name: "王者荣耀世界", aliases: ["王者荣耀世界"], sites: { bilibili: { cid: "1033", pid: "3" } }, douyu: "4298", huya: "71519" },
  { key: "g3785_1010235_1034", name: "王者万象棋", aliases: ["王者万象棋"], sites: { bilibili: { cid: "1034", pid: "3" } }, douyu: "3785", douyin: "1010235", douyinPid: "1" },
  { key: "group-wangyou", name: "网游", aliases: ["网游", "网游竞技", "射击游戏", "竞技游戏"], kind: "group", sites: { bilibili: { groupId: "2" } }, douyuGroup: "1", huyaTabId: "1", huyaGroup: "100023", douyinGroupIds: ["1", "2"], douyinPartitions: [{ cid: "1010037", pid: "1" }, { cid: "1010026", pid: "1" }, { cid: "1010014", pid: "1" }, { cid: "1010045", pid: "1" }] },
  { key: "g6007_1010533", name: "妄想山海", aliases: ["妄想山海"], huya: "6007", douyin: "1010533", douyinPid: "1" },
  { key: "g1693_2694", name: "围棋", aliases: ["围棋"], douyu: "1693", huya: "2694" },
  { key: "g1010289_787", name: "蔚蓝档案", aliases: ["蔚蓝档案"], sites: { bilibili: { cid: "787", pid: "3" } }, douyin: "1010289", douyinPid: "1" },
  { key: "g107_1010116_670", name: "问道", aliases: ["问道"], sites: { bilibili: { cid: "670", pid: "2" } }, huya: "107", douyin: "1010116", douyinPid: "1" },
  { key: "g44_1732_1010022_216", name: "我的世界", aliases: ["我的世界"], sites: { bilibili: { cid: "216", pid: "6" } }, douyu: "44", huya: "1732", douyin: "1010022", douyinPid: "1" },
  { key: "g532_2566", name: "无人深空", aliases: ["无人深空"], douyu: "532", huya: "2566" },
  { key: "valorant", name: "无畏契约", aliases: ["无畏契约", "valorant", "瓦罗兰特"], sites: { bilibili: { cid: "329", pid: "2" } }, douyu: "5937", huya: "5937", douyin: "1010017", douyinPid: "1" },
  { key: "g4290_62639_1011309_984", name: "无畏契约：源能行动", aliases: ["无畏契约：源能行动"], sites: { bilibili: { cid: "984", pid: "3" } }, douyu: "4290", huya: "62639", douyin: "1011309", douyinPid: "1" },
  { key: "g1010253_892", name: "无限暖暖", aliases: ["无限暖暖"], sites: { bilibili: { cid: "892", pid: "3" } }, douyin: "1010253", douyinPid: "1" },
  { key: "g4297_980", name: "无主星渊", aliases: ["无主星渊"], sites: { bilibili: { cid: "980", pid: "2" } }, douyu: "4297" },
  { key: "ol", name: "希望OL", aliases: ["希望OL"], douyu: "4239", huya: "1161" },
  { key: "g1010050_689", name: "香肠派对", aliases: ["香肠派对"], sites: { bilibili: { cid: "689", pid: "3" } }, douyin: "1010050", douyinPid: "1" },
  { key: "g1011133_586", name: "消逝的光芒", aliases: ["消逝的光芒"], sites: { bilibili: { cid: "586", pid: "6" } }, douyin: "1011133", douyinPid: "1" },
  { key: "g3529_7581", name: "消逝的光芒2", aliases: ["消逝的光芒2"], douyu: "3529", huya: "7581" },
  { key: "g1962_6259", name: "新剑侠情缘手游", aliases: ["新剑侠情缘手游"], douyu: "1962", huya: "6259" },
  { key: "g5671_653", name: "新天龙八部", aliases: ["新天龙八部"], sites: { bilibili: { cid: "653", pid: "2" } }, huya: "5671" },
  { key: "g3160_889", name: "新游推荐", aliases: ["新游推荐"], sites: { bilibili: { cid: "889", pid: "6" } }, huya: "3160" },
  { key: "g126_1010250_249", name: "星际战甲", aliases: ["星际战甲"], sites: { bilibili: { cid: "249", pid: "2" } }, douyu: "126", douyin: "1010250", douyinPid: "1" },
  { key: "g1010509_93", name: "星际争霸2", aliases: ["星际争霸2"], sites: { bilibili: { cid: "93", pid: "2" } }, douyin: "1010509", douyinPid: "1" },
  { key: "g816_2443_1010791", name: "星露谷物语", aliases: ["星露谷物语"], douyu: "816", huya: "2443", douyin: "1010791", douyinPid: "1" },
  { key: "xingxiu", name: "星秀", aliases: ["星秀", "颜值"], douyu: "1008", huya: "1663" },
  { key: "g1557_331", name: "星战前夜：晨曦", aliases: ["星战前夜：晨曦"], sites: { bilibili: { cid: "331", pid: "2" } }, douyu: "1557" },
  { key: "g201_2168_145", name: "颜值", aliases: ["颜值"], sites: { bilibili: { cid: "145", pid: "1" } }, douyu: "201", huya: "2168" },
  { key: "g3775_8019_1010271_903", name: "燕云十六声", aliases: ["燕云十六声"], sites: { bilibili: { cid: "903", pid: "2" } }, douyu: "3775", huya: "8019", douyin: "1010271", douyinPid: "1" },
  { key: "g366_3082_1010412_913", name: "一梦江湖", aliases: ["一梦江湖"], sites: { bilibili: { cid: "913", pid: "3" } }, douyu: "366", huya: "3082", douyin: "1010412", douyinPid: "1" },
  { key: "yiqikan", name: "一起看", aliases: ["一起看"], douyu: "208", huya: "2135" },
  { key: "g1575_6613", name: "一起玩", aliases: ["一起玩"], douyu: "1575", huya: "6613" },
  { key: "g1010088_755", name: "以闪亮之名", aliases: ["以闪亮之名"], sites: { bilibili: { cid: "755", pid: "3" } }, douyin: "1010088", douyinPid: "1" },
  { key: "g4272_68169_940", name: "异环", aliases: ["异环"], sites: { bilibili: { cid: "940", pid: "3" } }, douyu: "4272", huya: "68169" },
  { key: "g68127_956", name: "异人之下", aliases: ["异人之下"], sites: { bilibili: { cid: "956", pid: "3" } }, huya: "68127" },
  { key: "g3682_1010560", name: "弈仙牌", aliases: ["弈仙牌"], douyu: "3682", douyin: "1010560", douyinPid: "1" },
  { key: "g240_2598_1010025_36", name: "阴阳师", aliases: ["阴阳师"], sites: { bilibili: { cid: "36", pid: "3" } }, douyu: "240", huya: "2598", douyin: "1010025", douyinPid: "1" },
  { key: "g54_2761", name: "音乐游戏", aliases: ["音乐游戏"], douyu: "54", huya: "2761" },
  { key: "g77_1830_690", name: "英魂之刃", aliases: ["英魂之刃"], sites: { bilibili: { cid: "690", pid: "2" } }, douyu: "77", huya: "1830" },
  { key: "g1837_6609", name: "英灵神殿", aliases: ["英灵神殿"], douyu: "1837", huya: "6609" },
  { key: "lol", name: "英雄联盟", aliases: ["英雄联盟", "lol", "league of legends", "英雄联盟赛事"], sites: { bilibili: { cid: "86", pid: "2" } }, douyu: "1", huya: "1", douyin: "1010014", douyinPid: "1" },
  { key: "g6203_1010023", name: "英雄联盟手游", aliases: ["英雄联盟手游"], huya: "6203", douyin: "1010023", douyinPid: "1" },
  { key: "g448_2688", name: "英雄杀", aliases: ["英雄杀"], douyu: "448", huya: "2688" },
  { key: "g1010214_870", name: "萤火突击", aliases: ["萤火突击"], sites: { bilibili: { cid: "870", pid: "3" } }, douyin: "1010214", douyinPid: "1" },
  { key: "g408_156", name: "影之诗", aliases: ["影之诗"], sites: { bilibili: { cid: "156", pid: "3" } }, douyu: "408" },
  { key: "g997_459", name: "永恒轮回", aliases: ["永恒轮回"], sites: { bilibili: { cid: "459", pid: "2" } }, douyu: "997" },
  { key: "g167_446_684", name: "永恒之塔", aliases: ["永恒之塔"], sites: { bilibili: { cid: "684", pid: "2" } }, douyu: "167", huya: "446" },
  { key: "g1227_6219_1010016_666", name: "永劫无间", aliases: ["永劫无间"], sites: { bilibili: { cid: "666", pid: "2" } }, douyu: "1227", huya: "6219", douyin: "1010016", douyinPid: "1" },
  { key: "g3536_7579_1010278_882", name: "永劫无间手游", aliases: ["永劫无间手游"], sites: { bilibili: { cid: "882", pid: "3" } }, douyu: "3536", huya: "7579", douyin: "1010278", douyinPid: "1" },
  { key: "g1674_7669", name: "幽灵线：东京", aliases: ["幽灵线：东京"], douyu: "1674", huya: "7669" },
  { key: "g4451_1010378_407", name: "游戏王：决斗链接", aliases: ["游戏王：决斗链接"], sites: { bilibili: { cid: "407", pid: "3" } }, huya: "4451", douyin: "1010378", douyinPid: "1" },
  { key: "group-yule", name: "娱乐", aliases: ["娱乐", "娱乐天地", "休闲益智", "吃喝玩乐"], kind: "group", sites: { bilibili: { groupId: "1" } }, douyuGroup: "2", huyaTabId: "8", huyaGroup: "100022", douyinGroupIds: ["5"], douyinPartitions: [{ cid: "1010011", pid: "1" }, { cid: "1010022", pid: "1" }] },
  { key: "g4149_9521_1010263_822", name: "元梦之星", aliases: ["元梦之星"], sites: { bilibili: { cid: "822", pid: "3" } }, douyu: "4149", huya: "9521", douyin: "1010263", douyinPid: "1" },
  { key: "g536_1010343", name: "元气骑士", aliases: ["元气骑士"], douyu: "536", douyin: "1010343", douyinPid: "1" },
  { key: "g1223_5489_1010039_321", name: "原神", aliases: ["原神"], sites: { bilibili: { cid: "321", pid: "3" } }, douyu: "1223", huya: "5489", douyin: "1010039", douyinPid: "1" },
  { key: "g3806_7925_1010176", name: "原子之心", aliases: ["原子之心"], douyu: "3806", huya: "7925", douyin: "1010176", douyinPid: "1" },
  { key: "g1010024_215", name: "月圆之夜", aliases: ["月圆之夜"], sites: { bilibili: { cid: "215", pid: "3" } }, douyin: "1010024", douyinPid: "1" },
  { key: "tft", name: "云顶之弈", aliases: ["云顶之弈", "lol云顶之弈", "tft"], douyu: "917", huya: "5485", douyin: "1010005", douyinPid: "1" },
  { key: "40k", name: "战锤40K：暗潮", aliases: ["战锤40K：暗潮"], douyu: "3773", huya: "3016" },
  { key: "6", name: "战地风云6", aliases: ["战地风云6"], sites: { bilibili: { cid: "597", pid: "6" } }, huya: "4371" },
  { key: "g3969_1010108", name: "战火勋章", aliases: ["战火勋章"], douyu: "3969", douyin: "1010108", douyinPid: "1" },
  { key: "g2847_1947_1010418_248", name: "战舰世界", aliases: ["战舰世界"], sites: { bilibili: { cid: "248", pid: "2" } }, douyu: "2847", huya: "1947", douyin: "1010418", douyinPid: "1" },
  { key: "g1010788_579", name: "战神", aliases: ["战神"], sites: { bilibili: { cid: "579", pid: "6" } }, douyin: "1010788", douyinPid: "1" },
  { key: "g1382_1010445", name: "战术小队", aliases: ["战术小队"], douyu: "1382", douyin: "1010445", douyinPid: "1" },
  { key: "g1010089_293", name: "战双帕弥什", aliases: ["战双帕弥什"], sites: { bilibili: { cid: "293", pid: "3" } }, douyin: "1010089", douyinPid: "1" },
  { key: "g310_383", name: "战意", aliases: ["战意"], sites: { bilibili: { cid: "383", pid: "2" } }, douyu: "310" },
  { key: "g624_1010170_316", name: "战争雷霆", aliases: ["战争雷霆"], sites: { bilibili: { cid: "316", pid: "2" } }, huya: "624", douyin: "1010170", douyinPid: "1" },
  { key: "g1034_1599", name: "真三国无双", aliases: ["真三国无双"], douyu: "1034", huya: "1599" },
  { key: "g1105_485_1010324_309", name: "植物大战僵尸", aliases: ["植物大战僵尸"], sites: { bilibili: { cid: "309", pid: "6" } }, douyu: "1105", huya: "485", douyin: "1010324", douyinPid: "1" },
  { key: "g2667_1010067_1065", name: "植物大战僵尸2", aliases: ["植物大战僵尸2"], sites: { bilibili: { cid: "1065", pid: "3" } }, douyu: "2667", douyin: "1010067", douyinPid: "1" },
  { key: "g658_245", name: "只狼", aliases: ["只狼"], sites: { bilibili: { cid: "245", pid: "6" } }, douyu: "658" },
  { key: "g4505_1010149", name: "只狼：影逝二度", aliases: ["只狼：影逝二度"], huya: "4505", douyin: "1010149", douyinPid: "1" },
  { key: "g7215_1010040", name: "指尖四川麻将", aliases: ["指尖四川麻将"], huya: "7215", douyin: "1010040", douyinPid: "1" },
  { key: "g3868_1010435", name: "至暗时刻", aliases: ["至暗时刻"], douyu: "3868", douyin: "1010435", douyinPid: "1" },
  { key: "g4196_858", name: "致命公司", aliases: ["致命公司"], sites: { bilibili: { cid: "858", pid: "6" } }, douyu: "4196" },
  { key: "g543_1671", name: "中国象棋", aliases: ["中国象棋"], douyu: "543", huya: "1671" },
  { key: "g1976_426", name: "重生细胞", aliases: ["重生细胞"], sites: { bilibili: { cid: "426", pid: "6" } }, douyu: "1976" },
  { key: "g3332_7749_1010151_654", name: "诛仙世界", aliases: ["诛仙世界"], sites: { bilibili: { cid: "654", pid: "2" } }, douyu: "3332", huya: "7749", douyin: "1010151", douyinPid: "1" },
  { key: "host", name: "主机游戏", aliases: ["主机", "主机游戏", "switch", "ps5"], sites: { bilibili: { cid: "236", pid: "6" } }, douyu: "19", huya: "100032" },
  { key: "g3562_2276", name: "装甲战争", aliases: ["装甲战争"], douyu: "3562", huya: "2276" },
  { key: "g3690_100029", name: "综合手游", aliases: ["综合手游"], douyu: "3690", huya: "100029" },
  { key: "nba", name: "最强NBA", aliases: ["最强NBA"], douyu: "318", douyin: "1010107", douyinPid: "1" },
  { key: "14", name: "最终幻想14", aliases: ["最终幻想14"], sites: { bilibili: { cid: "102", pid: "2" } }, douyu: "41" },
  { key: "apex", name: "Apex英雄", aliases: ["Apex英雄"], huya: "5011", douyin: "1010002", douyinPid: "1" },
  { key: "g178_2413_333", name: "CF手游", aliases: ["CF手游"], sites: { bilibili: { cid: "333", pid: "3" } }, douyu: "178", huya: "2413" },
  { key: "cfhd", name: "CFHD", aliases: ["CFHD"], sites: { bilibili: { cid: "472", pid: "2" } }, douyu: "1997", huya: "6079" },
  { key: "cod", name: "COD手游", aliases: ["COD手游"], douyu: "767", huya: "4769" },
  { key: "cs2", name: "CS2", aliases: ["cs2", "csgo", "反恐精英", "counter-strike", "cs:go"], sites: { bilibili: { cid: "89", pid: "2" } }, douyu: "6", huya: "862", douyin: "1010003", douyinPid: "1" },
  { key: "g1092_4921_343", name: "DNF手游", aliases: ["DNF手游"], sites: { bilibili: { cid: "343", pid: "3" } }, douyu: "1092", huya: "4921" },
  { key: "dota1", name: "DOTA1", aliases: ["DOTA1"], huya: "6", douyin: "1010341", douyinPid: "1" },
  { key: "dota2", name: "DOTA2", aliases: ["dota2", "dota 2", "刀塔"], sites: { bilibili: { cid: "92", pid: "2" } }, douyu: "7", huya: "7", douyin: "1010093", douyinPid: "1" },
  { key: "dreadhunger", name: "Dread Hunger", aliases: ["Dread Hunger"], sites: { bilibili: { cid: "591", pid: "6" } }, huya: "7601" },
  { key: "jj", name: "JJ斗地主", aliases: ["JJ斗地主"], sites: { bilibili: { cid: "724", pid: "3" } }, douyu: "454", huya: "3841", douyin: "1010004", douyinPid: "1" },
  { key: "g2286_1010063", name: "JJ象棋", aliases: ["JJ象棋"], douyu: "2286", douyin: "1010063", douyinPid: "1" },
  { key: "kards", name: "KARDS", aliases: ["KARDS"], sites: { bilibili: { cid: "835", pid: "6" } }, huya: "8261" },
  { key: "g1920_395", name: "LOL手游", aliases: ["LOL手游"], sites: { bilibili: { cid: "395", pid: "3" } }, douyu: "1920" },
  { key: "nba2k", name: "NBA2K", aliases: ["NBA2K"], sites: { bilibili: { cid: "362", pid: "6" } }, douyu: "473" },
  { key: "nba2kol2", name: "NBA2KOL2", aliases: ["NBA2KOL2"], sites: { bilibili: { cid: "581", pid: "2" } }, douyu: "438" },
  { key: "picopark", name: "PICO PARK", aliases: ["PICO PARK"], douyu: "3016", douyin: "1011299", douyinPid: "1" },
  { key: "g331_9_610", name: "QQ飞车", aliases: ["QQ飞车"], sites: { bilibili: { cid: "610", pid: "2" } }, douyu: "331", huya: "9" },
  { key: "qq", name: "QQ飞车端游", aliases: ["QQ飞车端游"], douyu: "375", douyin: "1010146", douyinPid: "1" },
  { key: "g2928_1010033_154", name: "QQ飞车手游", aliases: ["QQ飞车手游"], sites: { bilibili: { cid: "154", pid: "3" } }, huya: "2928", douyin: "1010033", douyinPid: "1" },
  { key: "g1090_685", name: "QQ三国", aliases: ["QQ三国"], sites: { bilibili: { cid: "685", pid: "2" } }, huya: "1090" },
  { key: "g710_2440", name: "QQ炫舞", aliases: ["QQ炫舞"], douyu: "710", huya: "2440" },
  { key: "scum", name: "SCUM", aliases: ["SCUM"], douyu: "567", huya: "4245" },
];

let categories = FALLBACK_CATEGORIES;
let loadPromise = null;

/** 各平台 cid 不同，跨平台 key 对应斗鱼 cid 需手工校正 */
const CROSS_DOUYU_CID_PATCH = {
  dnf: "40",
};

export function findCrossCategoryByKey(key) {
  const text = String(key || "").trim();
  if (!text) return null;
  const entry =
    categories.find((e) => e.key === text) ||
    FALLBACK_CATEGORIES.find((e) => e.key === text) ||
    null;
  if (!entry) return null;
  const patchDouyu = CROSS_DOUYU_CID_PATCH[text];
  if (patchDouyu && entry.douyu !== patchDouyu) {
    return { ...entry, douyu: patchDouyu };
  }
  return entry;
}

export function douyuCidForCrossKey(key, fallback) {
  const entry = findCrossCategoryByKey(key);
  if (entry?.douyu) return String(entry.douyu);
  return String(fallback || "");
}

export function huyaCidForCrossKey(key, fallback) {
  const entry = findCrossCategoryByKey(key);
  if (entry?.huya) return String(entry.huya);
  return String(fallback || "");
}

function norm(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function gameCidForSite(entry, site) {
  const ref = entry.sites?.[site];
  if (ref?.cid) return ref.cid;
  if (site === "douyu") return entry.douyu;
  if (site === "huya") return entry.huya;
  if (site === "douyin") return entry.douyin;
  return undefined;
}

function groupCidForSite(entry, site) {
  const ref = entry.sites?.[site];
  if (ref?.groupId) return ref.groupId;
  if (site === "douyu") return entry.douyuGroup;
  if (site === "huya") return entry.huyaGroup;
  return undefined;
}

export function findCrossCategory(site, categoryName, cid) {
  const siteId = String(site || "").trim();
  const cidText = String(cid || "").trim();
  if (cidText && siteId) {
    for (const entry of categories) {
      if (entry.kind === "group") continue;
      const mapped = gameCidForSite(entry, siteId);
      if (mapped && mapped === cidText) return entry;
    }
    for (const entry of categories) {
      if (entry.kind !== "group") continue;
      const groupCid = groupCidForSite(entry, siteId);
      if (groupCid && groupCid === cidText) return entry;
      if (siteId === "huya" && entry.huyaTabId && entry.huyaTabId === cidText) return entry;
      if (siteId === "douyin") {
        if (entry.douyinGroupIds?.some((id) => id === cidText)) return entry;
        if (entry.douyinPartitions?.some((part) => part.cid === cidText)) return entry;
      }
    }
  }

  const name = norm(categoryName);
  if (!name) return null;

  for (const entry of categories) {
    if (norm(entry.name) === name) return entry;
    for (const alias of entry.aliases || []) {
      const a = norm(alias);
      if (a && (name === a || name.includes(a) || a.includes(name))) return entry;
    }
  }
  return null;
}

/** 统一展示名：命中跨平台映射用 canonical name，否则用平台原名 */
export function displayCategoryName(site, categoryName, cid) {
  const raw = String(categoryName || "").trim();
  if (!raw) return "";
  const entry = findCrossCategory(site, raw, cid);
  return entry?.name || raw;
}

export function displayCategoryGroupName(site, categoryName, cid) {
  const raw = String(categoryName || "").trim();
  if (!raw) return "";
  if (site === "douyin" || site === "douyu" || site === "huya" || site === "bilibili") return raw;
  return displayCategoryName(site, raw, cid);
}

export async function loadCategoryCrossMap() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch(apiUrl("/api/category-cross-map"), { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok && Array.isArray(data.categories) && data.categories.length) {
        categories = data.categories;
      }
    } catch {
      /* 使用 FALLBACK */
    }
  })();
  return loadPromise;
}
