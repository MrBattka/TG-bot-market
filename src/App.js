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

            const parseSpec = (name = "") => {
              // примеры: "Xiaomi Redmi A5 4G 3/64 Blue", "Xiaomi Redmi 13 6/128GB Midnight Black"
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
              // берём только реальные цены (>0)
              const priced = group.filter(x => Number(x.price) > 0);
              if (priced.length === 0) return;

              // выбираем источник: сначала по RAM, затем по storage
              const source = priced.reduce((best, cur) => {
                if (!best) return cur;
                if (cur.spec.ram > best.spec.ram) return cur;
                if (cur.spec.ram === best.spec.ram && cur.spec.storage > best.spec.storage) return cur;
                return best;
              }, null);

              const sourcePrice = Number(source.price);
              const sourceRam = source.spec.ram;
              const sourceStorage = source.spec.storage;

              group.forEach(item => {
                const targetIdx = item.__idx;
                const curPrice = copy[targetIdx].price;
                const isSmaller =
                  (item.spec.ram < sourceRam) ||
                  (item.spec.ram === sourceRam && item.spec.storage < sourceStorage);

                if (isSmaller && (curPrice == null || curPrice === "" || Number(curPrice) === 0)) {
                  copy[targetIdx].price = sourcePrice;
                }
              });
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