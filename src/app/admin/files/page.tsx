import {requireAdmin} from "@/lib/auth";
import {database,dbError} from "@/lib/db";
import {FileLibrary,type LibraryFile,type Folder} from "@/components/workspace-ui";
export const dynamic="force-dynamic";
export default async function Files(){await requireAdmin();const db=database();const [files,folders]=await Promise.all([db.from("files").select("id,name,folder_id,mime,bytes,visibility").order("created_at",{ascending:false}).limit(500),db.from("folders").select("id,name").order("name")]);dbError(files.error);dbError(folders.error);return <><FileLibrary files={(files.data||[]) as LibraryFile[]} folders={(folders.data||[]) as Folder[]}/></>;}
