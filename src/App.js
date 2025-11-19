import { useState } from "react";
import style from "./App.module.css";
import { read, utils, writeFile } from "xlsx";
import icon from "./source/icon/icon1.png"

function App() {
  const [data, setData] = useState([]);

  const handleImportForOrder = ($event) => {
    const files = $event.target.files;
    if (files.length) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const wb = read(event.target.result);
        const sheets = wb.SheetNames;

        if (sheets.length) {
          const dataSheet = utils.sheet_to_json(wb.Sheets[sheets[0]]);

          // Преобразование: группировка по базе + цвет; источник цены — запись с наибольшим RAM (при равном RAM — с наибольшим storage).
          // Копируем цену на модели с меньшим RAM или с тем же RAM и меньшим storage. 0 считается отсутствующей ценой.
          const applyPrices = (rows) => {
            const copy = rows.map(r => ({ ...r }));

            const parseNumber = (v) => {
              if (v == null || v === "") return 0;
              const s = String(v).replace(",", ".").replace(/\s+/g, "");
              const n = Number(s);
              return Number.isFinite(n) ? n : 0;
            };

            const parseSpec = (name = "") => {
              const m = name.match(/^(.+?)\s+(\d+)\/(\d+)\s*(?:GB)?\s*(.+)$/i);
              if (!m) return null;
              return {
                base: m[1].trim(),
                ram: parseInt(m[2], 10),
                storage: parseInt(m[3], 10),
                color: m[4].trim(),
              };
            };

            const groups = {};
            copy.forEach((r, idx) => {
              if (!r.name) return;
              const spec = parseSpec(r.name);
              if (!spec) return;
              const key = `${spec.base}||${spec.color}`;
              groups[key] = groups[key] || [];
              groups[key].push({ ...r, __idx: idx, spec });
            });

            Object.values(groups).forEach(group => {
              // сортируем сверху вниз: RAM desc, затем storage desc
              group.sort((a, b) => {
                if (a.spec.ram !== b.spec.ram) return b.spec.ram - a.spec.ram;
                return b.spec.storage - a.spec.storage;
              });

              let runningPrice = null;
              let basePurchase = null;      // если источник — purchase, держим его здесь
              let cumulativeMinus = 0;      // сумма минусов от источника

              for (let i = 0; i < group.length; i++) {
                const item = group[i];
                const idx = item.__idx;

                const existingPrice = parseNumber(item.price);   // уже проставленная price
                const purchase = parseNumber(item.purchase);     // source purchase
                const minusVal = parseNumber(item.minus);       // вычитаем для нижних

                // Если есть purchase — используем его как источник (предпочтение перед price).
                // При этом не перезаписываем уже проставленный price на этой строке.
                if (purchase > 0) {
                  if (existingPrice === 0) {
                    copy[idx].price = purchase;
                  }
                  basePurchase = purchase;
                  runningPrice = purchase;
                  cumulativeMinus = 0;
                  continue;
                }

                // Если нет purchase, но есть уже проставленный price — используем его как источник (только чтение).
                if (existingPrice > 0) {
                  basePurchase = null;
                  cumulativeMinus = 0;
                  runningPrice = existingPrice;
                  continue;
                }

                // Нет ни purchase, ни price на текущей строке:
                // если есть текущий источник сверху — вычисляем новую цену и записываем только если price пустая
                if (runningPrice != null) {
                  if (basePurchase != null) {
                    // вычитаем минусы из original purchase (накопительно)
                    cumulativeMinus += minusVal;
                    const newPrice = Math.max(0, basePurchase - cumulativeMinus);
                    if (parseNumber(copy[idx].price) === 0) {
                      copy[idx].price = newPrice;
                    }
                    runningPrice = newPrice;
                  } else {
                    // источник — ранее найденная price (нет purchase выше) => вычитаем из runningPrice
                    const newPrice = Math.max(0, runningPrice - minusVal);
                    if (parseNumber(copy[idx].price) === 0) {
                      copy[idx].price = newPrice;
                    }
                    runningPrice = newPrice;
                  }
                }
                // иначе — нет источника сверху, оставляем пустым
              }
            });

            return copy;
          };

          const withPrices = applyPrices(dataSheet);
          setData(withPrices);
          try {
            const ws = utils.json_to_sheet(withPrices);
            const wbOut = utils.book_new();
            utils.book_append_sheet(wbOut, ws, "Sheet1");
            const outName = (file.name || "output")
              .replace(/\.(xlsx|xls|csv)$/i, "") + "_with_prices.xlsx";
            writeFile(wbOut, outName);
          } catch (e) {
            console.error("Export error:", e);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };


  console.log(data);

  return (
    <div className={style.App}>
      <img className={style.img} src={icon} alt="Not found" />
      <div className={style.flexbox}>
        <div>
          <div className={style.row}>
            <div>
              <div>
                <div className={style.custom_file}>
                  <label for="inputGroupFile" className={style.custom_file_upload}>
                    Select File...
                  </label>
                  <input
                    type="file"
                    name="file"
                    className={style.custom_file_input}
                    id="inputGroupFile"
                    required
                    onChange={handleImportForOrder}
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  />
                </div>
              </div>
            </div>
            <div className={style.col_md_6}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;