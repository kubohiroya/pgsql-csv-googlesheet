import * as fs from 'fs-extra';
export const mkdir = (dir: string)=>{
    if (fs.statSync(dir).isDirectory()) {
        fs.readdirSync(dir).forEach(file => {
            fs.unlinkSync(dir + '/' + file);
        });
    } else {
        fs.unlinkSync(dir);
        fs.mkdirSync(dir);
    }
};
