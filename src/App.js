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
              // Захватываем: base, RAM, storage, опционально единицу (GB|TB), и цвет/доп.инфо
              const m = name.match(/^(.+?)\s+(\d+)\/(\d+)\s*(?:(GB|TB))?\s*(.+)$/i);
              if (!m) return null;
              const base = m[1].trim();
              const ram = parseInt(m[2], 10);
              const storageRaw = parseInt(m[3], 10);
              const unit = m[4] ? m[4].toUpperCase() : null;
              const color = m[5].trim();

              // Если явно TB — переводим в GB. Если TB не указан, но формат 16/1 или 24/1 — считаем как 1TB.
              let storageGb = storageRaw;
              if (unit === "TB") storageGb = storageRaw * 1024;
              else if (!unit && (ram === 16 || ram === 24) && storageRaw === 1) storageGb = 1024;

              return { base, ram, storage: storageGb, color };
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

              // ищем источник: среди записей с price > 0 выбрать с наибольшим RAM, при равном RAM — с наибольшим storage
              const priced = group.filter(x => parseNumber(x.price) > 0);
              if (priced.length === 0) return;

              priced.sort((a, b) => {
                if (a.spec.ram !== b.spec.ram) return b.spec.ram - a.spec.ram;
                return b.spec.storage - a.spec.storage;
              });

              const source = priced[0];
              const sourcePrice = parseNumber(source.price);

              // найдём позицию источника в отсортированной группе
              const startIdx = group.findIndex(g => g.__idx === source.__idx);
              if (startIdx === -1) return;

              // running — текущая цена, от которой вычитаем minus при спуске вниз
              let running = sourcePrice;

              // пройти вниз по списку и проставлять цены, не перезаписывая уже заданные
              for (let i = startIdx + 1; i < group.length; i++) {
                const item = group[i];
                const idx = item.__idx;
                const curPrice = parseNumber(copy[idx].price);

                // если в этой строке уже есть price (>0) — используем её как новый источник и не перезаписываем
                if (curPrice > 0) {
                  running = curPrice;
                  continue;
                }

                // иначе вычитаем minus из текущего running и записываем результат в price (если пусто)
                const minusVal = parseNumber(item.minus);
                running = Math.max(0, running - minusVal);
                if (parseNumber(copy[idx].price) === 0) {
                  copy[idx].price = running;
                }
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