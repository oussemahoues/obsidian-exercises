import SelectExercise from "./SelectExercise";
import { Exercise } from "./Exercise";
import InputExercise from "./InputExercise";
import LineExercise from "./LineExercise";
import MatchExercise from "./MatchExercise";
import { App, Component, MarkdownPostProcessorContext, MarkdownRenderer, TFile, Notice } from "obsidian";
import MultipleChoiceExercise from "./MultipleChoiceExercise";

const REPLACE_STRING = '$#rp$';

export default (app:App, data:string, elm:HTMLElement, ctx:MarkdownPostProcessorContext)=>{
    elm.classList.add('exercise-block');
    const processOpts:Exercise[] = [];

    const processedArgs:{name:string,flags:FLAGS,data:string}[] = [];
    const processedData = data.replace(/\$(\w+)(:(?:.|\n)*?)*\{((?:.|\n|\))*?)\}/g, (substr,...args)=>{
        const flagStr = args[1] ?? '';
        const data = args[2].toString().trim();
        // <<
        const flags = handleFlags(flagStr);

        processedArgs.push({ name:args[0],flags,data });
        return REPLACE_STRING;
    }).split('\n').map(row=>row.split(REPLACE_STRING));

    let pos = 0;
    for(let i = 0; i < processedData.length; i++){
        const rowData = processedData[i];
        const el = elm.createEl('div');
        el.classList.add('exercise-row');

        for(let j = 0; j < rowData.length; j++){
            const dataElm = rowData[j];
            MarkdownRenderer.render(app,dataElm,el,ctx.sourcePath,new Component());
            // <<
            if(j+1===rowData.length) continue;
            if(!processedArgs[pos]) continue;
            const { name,flags,data } = processedArgs[pos++];
            const res = getExercise(name,el,data,flags);
            if(res) processOpts.push(res);
        }
    }
    // <<
    const btns = elm.createEl('div');
    const btnReveal = document.createElement('button');
    btnReveal.classList.add('btn-exercise');
    btnReveal.classList.add('btn-exercise-reveal');
    const btnCheck = document.createElement('button');
    btnCheck.classList.add('btn-exercise');
    btnCheck.classList.add('btn-exercise-check');
    const btnSave = document.createElement('button');
    btnSave.classList.add('btn-exercise');
    btnSave.classList.add('btn-exercise-save');

    btns.appendChild(btnReveal); btnReveal.textContent = 'Reveal';
    btns.appendChild(btnCheck); btnCheck.textContent = 'Check';
    btns.appendChild(btnSave); btnSave.textContent = 'Submit & Save';

    const validTxt = document.createElement('span');
    validTxt.classList.add('valid-text');
    btns.appendChild(validTxt); validTxt.textContent = '';
    // <<
    btnReveal.addEventListener('click',()=>{
        for(const opt of processOpts) opt.reveal();
        validTxt.textContent = '';
    });
    btnCheck.addEventListener('click',()=>{
        let valid = 0; let length = 0;
        for(const opt of processOpts){
            valid+= opt.validate();
            length+= opt.length;
        }
        validTxt.textContent = '';
        const vTxtValue = validTxt.createEl('b');
        /*/*/ vTxtValue.textContent = valid.toString();
        const vTxtInfo = validTxt.createEl('span');
        /*/*/ vTxtInfo.textContent = '/' + length + ' (' + Math.round(valid*100 / length) + '%)';
    });

    btnSave.addEventListener('click', async () => {
        let valid = 0; let length = 0;
        let summary = `\n\n---\n**📝 Quiz Results: ${formatDate(new Date())}**\n`;
        let qLines = "";

        let qIndex = 1;
        for(const opt of processOpts){
            const score = opt.validate();
            const total = opt.length;
            valid += score;
            length += total;

            const isCorrect = score === total;
            const icon = isCorrect ? "✅" : "❌";
            const status = isCorrect ? "Correct" : "Incorrect";
            const userAnswer = opt.getAnswer();
            const answerText = userAnswer ? ` (Answer: ${userAnswer})` : '';
            qLines += `${icon} Q${qIndex}: ${status}${answerText}\n`;
            qIndex++;
        }

        const percentage = length > 0 ? Math.round((valid / length) * 100) : 0;
        summary += `**Score:** ${valid}/${length} (${percentage}%)\n`;
        summary += qLines;

        // Append to file
        const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (file instanceof TFile) {
            await app.vault.append(file, summary);
            new Notice(`Results saved to ${file.basename}`);
        } else {
            new Notice("Could not save results: File not found.");
        }

        // Also update UI score text like Check button does
        validTxt.textContent = '';
        const vTxtValue = validTxt.createEl('b');
        vTxtValue.textContent = valid.toString();
        const vTxtInfo = validTxt.createEl('span');
        vTxtInfo.textContent = '/' + length + ' (' + percentage + '%)';
    });
}

function formatDate(date: Date) {
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    const YYYY = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${YYYY}-${MM}-${DD} ${HH}:${mm}`;
}

export function getExercise(name:string,elm:HTMLElement,dataStr:string,flags:FLAGS):Exercise|null {
    switch(name){
        case 'select':  case 's': return new SelectExercise(elm,dataStr,flags);
        case 'input':   case 'i': return new InputExercise(elm,dataStr,flags);
        case 'line':    case 'l': return new LineExercise(elm,dataStr,flags);
        case 'match':   case 'm': return new MatchExercise(elm,dataStr,flags);
        case 'choice':  case 'c': return new MultipleChoiceExercise(elm,dataStr,flags);
    }
    return null;
}

export type FLAGS = {
    case: boolean,
    random: boolean,
};
export const DEFAULT_FLAGS:FLAGS = {
    case: false,
    random: false,
};

export function handleFlags(flags:string):FLAGS {
    const flagArr = { ...DEFAULT_FLAGS };
    for(const flag of flags){
        switch(flag.toLowerCase()){
            case 'c': flagArr.case = true; break;
            case 'r': flagArr.random = true; break;
        }
    }
    return flagArr;
}
