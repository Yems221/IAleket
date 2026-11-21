# Recherche : le logo de leketia

*Recherche documentaire, 21 novembre 2026. Aucun visuel n'a été produit et aucun code n'a été modifié.*

**Convention de lecture.**
- **[V]** : vérifié dans la source citée (page lue ou extrait de résultat de recherche).
- **[S]** : source secondaire (blog, agrégateur, presse non spécialisée), signalée comme telle.
- **[D]** : déduction de l'auteur de cette recherche, à valider.
- Quand une source n'a pas pu être lue (erreur 403, contenu tronqué), c'est indiqué.

---

## 1. Résumé (ce qu'il faut retenir)

1. Un logo **identifie** : il ne décrit pas et n'explique pas (Paul Rand). Il n'a pas à montrer « la calebasse + la donnée + l'IA » d'un coup : une seule idée suffit, exprimée simplement.
2. Bierut compare le logo à **un récipient vide** que l'usage remplit. Le leket est déjà un récipient : la forme du bol peut porter le sens à elle seule.
3. La silhouette passe avant le rendu. Il faut d'abord un dessin plat, en une couleur, lisible à 16 px. Le « réalisme » vient ensuite, dans une couche de matière : c'est ce que font Airbnb, Microsoft 365 et Apple (Liquid Glass) en 2025-2026.
4. Apple demande de laisser le système appliquer reflets, ombres et biseaux, et de ne pas les dessiner dans l'icône. Un rendu 3D figé est le contraire de cette règle.
5. Une calebasse n'est pas une terre cuite. C'est une écorce de fruit légère, beige à ocre, à bord coupé, souvent gravée ou pyrogravée en noir. Le « réalisme » commence par cette fidélité au matériau.
6. Les métaphores de la donnée qui sont devenues des clichés : 0/1, cubes, étincelle ✨, dégradé violet, réseau de nœuds, cerveau, orbe. Les cubes empilés évoquent Docker.
7. La donnée peut se dire **par le geste artisanal**. Les points et les traits de pyrogravure sont déjà une écriture discrète, comme des bits. Le motif gravé peut donc devenir la donnée.
8. Nom : aucune marque « Leketia » trouvée. « Leket » est le nom de Leket Israel, une banque alimentaire, hors du champ tech. « Calabash » était le nom d'un framework de test mobile, abandonné vers 2017.
9. Avant de dessiner, il faut obtenir de la porteuse 3 images qu'elle juge « réalistes post-modernes » et 3 qu'elle rejette. Ces mots n'ont pas de sens partagé sans exemples.
10. Méthode : brief validé, puis références, puis croquis noir sur blanc (au moins 30), puis test de réduction, puis 3 pistes présentées en situation réelle, puis rendu matière, puis déclinaisons.

---

## 2. Méthode de conception recommandée, adaptée à leketia

### 2.1 Les principes de référence

| Principe | Ce que dit la source | Lien |
|---|---|---|
| Identifier, pas décrire | Paul Rand : un logo vend rarement directement, il identifie ; il est rarement une description de l'activité ; il prend son sens par association avec ce qu'il représente. Citation : « A logo doesn't sell (directly), it identifies. » [V] | [Rand, *Logos, Flags, and Escutcheons*, 1991](https://www.paulrand.design/writing/articles/1991-logos-flags-and-escutcheons.html) |
| Le logo comme récipient | Michael Bierut (Pentagram) : le logo est un récipient vide que l'histoire et l'expérience remplissent ; le travail du designer est de lui donner la bonne forme. [V] | [It's Nice That, 28/09/2015](https://itsnicethat.com/features/michael-bierut-logo-design) ; [Design Observer, archives Bierut](https://designobserver.com/the-mysterious-power-of-context/) |
| Trois critères | Sagi Haviv (Chermayeff & Geismar & Haviv) : approprié, distinctif et mémorable, simple. « Approprié » ne veut pas dire « expressif ». [S, résumés concordants] | [LogoGeek, podcast Haviv](https://logogeek.uk/podcast/sagi-haviv/) ; [99% Invisible](https://99percentinvisible.org/?p=23649) ; [cours Skillshare de Haviv](https://www.skillshare.com/en/classes/designing-brand-symbols-the-principles-and-process-of-making-logos-that-last/404415631) |
| Le crayon d'abord, la présentation en situation | Haviv commence au crayon sur papier. Un logo refusé sur une feuille blanche a été accepté une fois montré en situation (affiche, devanture). Un symbole doit avoir une raison d'exister, sinon on travaille le nom. [V] | [Logo Design Love, entretien Haviv](https://www.logodesignlove.com/sagi-haviv-interview) |
| Méthode documentée sur 50 cas | Livre de C&G&H qui expose le raisonnement derrière 50 identités. [V, fiche éditeur] | [*Identify*, HOW Books, 2011](https://www.simonandschuster.ca/books/Identify/Tom-Geismar/9781440320477) |
| Icône d'app : simplicité | Apple : « Embrace simplicity », trouver l'élément qui capte l'essence, l'exprimer avec un minimum de formes ; préférer un fond simple ; pas de texte non essentiel ; préférer l'illustration à la photo ; éviter les traits très fins. [V] | [Apple HIG, App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons) |
| Icône d'app : effets | Apple : laisser le système gérer reflets spéculaires, ombres entre calques, biseaux, flous et lueurs ; les effets dessinés sont statiques, ceux du système sont dynamiques. [V] | idem |
| Icône d'app : calques Liquid Glass | iOS/iPadOS/macOS/watchOS : un calque de fond et un ou plusieurs calques de premier plan, assemblés dans Icon Composer. Formes à bords nets, vectoriel (SVG/PDF), calques carrés non masqués, contenu centré. Variantes : défaut, sombre, clair (clear) et teinté, avec les mêmes éléments dans chaque variante. Format 1024×1024 px. [V] | idem ; [Icon Composer](https://developer.apple.com/icon-composer/) |
| Icône Android adaptative | Le premier plan doit tenir dans une zone sûre de 66×66 dp, au centre d'un canevas de 108×108 dp. Depuis Android 13, un calque monochrome sert aux icônes « à thème » teintées selon le fond d'écran. [V] | [Android Developers, Adaptive icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive) |
| Icône PWA (leketia est une PWA) | Icônes « maskable » : l'essentiel doit tenir dans un cercle central de rayon égal à 40 % de la largeur ; les 10 % du bord peuvent être rognés ; déclarer `purpose: "maskable"` dans le manifeste. [V] | [web.dev, Maskable icons](https://web.dev/articles/maskable-icon) |

### 2.2 Le processus pas à pas pour leketia

1. **Brief signé** (section 9). Une page. La décision la plus importante : *quelle seule idée le symbole porte-t-il ?*
2. **Lexique visuel de la porteuse.** Lui demander 3 images « réaliste post-moderne » qui lui plaisent et 3 qui lui déplaisent : logos, objets, affiches, sans se limiter aux logos. Sans ces exemples, ces deux mots peuvent vouloir dire beaucoup de choses opposées (voir section 3).
3. **Planche de références réelles** : photos de vraies calebasses, de profil, coupées, gravées (section 4). On regarde l'objet, pas des logos de calebasse.
4. **Croquis au crayon, en noir sur blanc**, sans couleur ni rendu. Au moins 30 silhouettes, en faisant varier trois paramètres : la forme (bol peu profond, bol profond, gourde entière, louche), le point de vue (profil strict, trois-quarts léger) et le signe de la donnée (section 5).
5. **Test de silhouette et de réduction** sur chaque croquis retenu : remplissage noir à plat, puis affichage à 16, 32, 48 et 180 px. On élimine tout ce qui se brouille. On compare aussi à une rangée d'icônes existantes, et surtout à Docker, Dropbox, Pocket et Raindrop (section 5.3).
6. **Trois pistes au maximum** présentées *en situation* (méthode Haviv) : écran d'accueil iOS et Android, onglet de navigateur, sticker, tampon imprimé à une couleur, et tampon pyrogravé sur une vraie calebasse si possible.
7. **Choix d'une piste, puis réglage fin** : grille de construction, épaisseurs, courbes optiques.
8. **Couche matière** (le « réaliste ») une fois la forme validée seulement : calques Icon Composer (fond et premier plan), puis éventuellement un rendu de présentation. La version plate une couleur reste **la source**. Le rendu se dérive d'elle, jamais l'inverse.
9. **Déclinaisons** : symbole seul, logotype « leketia », version horizontale, monochrome noir, version inversée, icônes iOS (défaut, sombre, clair, teinté), adaptive et monochrome Android, maskable PWA, favicon SVG, tampon d'impression.
10. **Garde-fous** : recherche d'antériorité visuelle (Google Lens ou recherche d'image inversée sur la silhouette finale), et vérification des marques déposées avant la diffusion publique (section 7).

---

## 3. « Réaliste » et « post-moderne » aujourd'hui : ce que cela veut dire concrètement

### 3.1 Post-moderne : le sens historique

- Le V&A (musée de référence, exposition *Postmodernism: Style and Subversion 1970–1990*, 2011-2012) résume les principes du postmodernisme par « complexity and contradiction ». Il cite aussi la couleur vive, la théâtralité, les surfaces jouées (brillant, faux, volontairement abîmé) et une subversion compatible avec l'attrait commercial. [V] [V&A, *What is Postmodernism?*](https://www.vam.ac.uk/articles/what-is-postmodernism)
- Selon Dezeen, le style était secondaire pour les modernistes et central pour les postmodernes. [S] [Dezeen guide](https://www.dezeen.com/?p=740006)
- Le groupe Memphis (Milan, 1981) a fixé l'idiome le plus associé au « design post-moderne » : motifs, couleurs vives, formes de dessin animé. [S] [Artforum](https://www.artforum.com/events/postmodernism-191704/)
- La section graphique de l'exposition (« Style Wars ») présentait Paula Scher, April Greiman et Peter Saville. [S] [Design Observer](https://designobserver.com/did-we-ever-stop-being-postmodern/)

**[D] Traduction pour leketia.** Le post-moderne ne se réduit pas à un rendu 3D. Il consiste à **citer une tradition** (la calebasse, la pyrogravure) et à la **confronter à un code contemporain** (le pixel, la trame d'écran, le verre), en assumant la tension entre les deux, avec de l'esprit plutôt que du sérieux. Il accepte l'ornement que le modernisme refusait. Pour un logo, il faut tout de même que la forme reste simple : la contradiction se joue entre **deux éléments au maximum**, pas cinq.

### 3.2 Réaliste : ce que montrent les identités de 2025-2026

| Exemple | Ce qui s'est passé | Ce qu'on en retient | Lien |
|---|---|---|---|
| Apple, iOS 26 « Liquid Glass » (2025, précisé en juin 2026) | Icônes en calques ; le système ajoute reflets, réfraction et translucidité ; variantes défaut, sombre, clair et teinté. [V] | Le réalisme est **calculé par le système** à partir de formes plates et nettes. On fournit des formes, pas un rendu. | [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/app-icons) ; [WWDC25, session 361](https://developer.apple.com/videos/play/wwdc2025/361) |
| Airbnb, refonte de l'app (mai 2025) | Nouvelles icônes 3D et illustrations réalisées en interne, construites sur deux ans environ ; la VP design les décrit comme utiles, universelles et ludiques. [V] Bloomberg y voit la fin du flat design (article non lu, 403). [S] | La 3D est un **système d'icônes d'interface**. Selon le texte lu, le logo Bélo n'a pas été mentionné comme changé. [D] Le logo reste plat. | [It's Nice That](https://www.itsnicethat.com/articles/airbnb-app-redesign-140525) ; [Bloomberg](https://www.bloomberg.com/news/articles/2025-06-13/apple-airbnb-ditch-flat-app-icons-for-new-3d-ui-design) ; [Creative Bloq](https://www.creativebloq.com/web-design/ux-ui/from-apple-to-airbnb-retro-icon-design-is-making-a-comeback) |
| Critique de ces icônes | Une analyse note que ces icônes n'aident pas l'usage et ne sont donc pas du skeuomorphisme au sens strict ; elle propose le terme « skeuo-pastiche ». Des jeux d'icônes similaires générés par IA ont vite proliféré. [S] | Le rendu « doux, détaillé, 3D » est désormais **reproductible par n'importe quel générateur**, donc peu distinctif. | [Midst Labs](https://midstlabs.substack.com/p/skin-deep-human-centered-design) ; [Automattic Design, *From flat to feel*](https://automattic.design/2025/07/01/from-flat-to-feel/) |
| Microsoft 365, nouvelles icônes (octobre 2025) | Redessinées à partir de l'icône Copilot : formes pliées et fluides, dégradés plus marqués, détails réduits pour rester lisibles en petit. [S, presse spécialisée, renvoyant au blog Microsoft Design] | Même les icônes « riches » **retirent du détail** pour tenir en petit. | [Microsoft Design](https://microsoft.design/articles/fluid-forms-vibrant-colors/) ; [Dezeen](https://www.dezeen.com/2025/10/06/microsoft-office-icons-rebrand/amp/) ; [Microsoft 365 Insider](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/new-microsoft-365-icons-for-the-ai-era/4458674) |
| Mistral AI (identité par le studio de Sylvain Boyer) | Emblème en pixels (« pixel cat », selon Mistral) ; la version en dégradé est la version préférée ; la version monochrome est prévue pour les fonds chargés ; recolorer le logo fait partie des usages interdits. [V pour la page de marque ; S pour l'attribution du studio] | Exemple clair de marque à rendu riche qui **prévoit une version monochrome officielle**. | [Mistral, page Brand](https://mistral.ai/brand) ; [Logos-World](https://logos-world.net/mistral-ai-unveils-new-logo-and-brand-identity/) |
| Tendances 2026 | Retour d'une 3D « tactile » plus sobre que le skeuomorphisme des années 2010 ; la texture devient un signe d'auteur face aux images de synthèse lisses. [S, articles de tendances] | Le « tactile » se veut une **réaction** à l'esthétique générée. Un rendu 3D lisse et plastique va donc à contre-courant de la tendance qu'il croit suivre. [D] | [Creative Bloq, tendances logo 2026](https://www.creativebloq.com/design/logos-icons/these-logo-design-trends-will-define-2026) ; [Creative Bloq, *Texture, warmth and tactile rebellion*](https://www.creativebloq.com/design/graphic-design/texture-warmth-and-tactile-rebellion-the-big-graphic-design-trends-for-2026) ; [Kota](https://kota.co.uk/blog/branding-inspiration-brand-design-trends-for-2026) |
| Dropbox (Collins, 2017) | Le logo est passé d'une boîte en 3D à cinq losanges plats qui suggèrent une boîte ouverte, pour dire « plateforme ouverte » plutôt que « stockage ». [V, citation Dropbox reprise par la presse] | Précédent direct pour **un récipient de fichiers** : la 3D littérale a été abandonnée au profit d'une suggestion plate. | [Design Week](https://www.designweek.co.uk/issues/2-8-october-2017/dropbox-rebrands-show-just-file-storage/) ; [Dezeen](https://www.dezeen.com/2017/10/11/dropbox-rebrand-logo-visual-identity-graphic-design/amp/) |

**[D] Comment les marques gèrent la version plate.** Dans tous les cas trouvés, il y a **une forme plate de référence** (le logo) et **une couche de rendu** (icône, illustration, motion) qui en dérive. Aucun cas trouvé ne part d'un rendu 3D pour en « extraire » une version plate après coup. C'est pourtant ce qui a été tenté pour leketia.

**[D] Proposition de définition à faire valider par la porteuse.** Pour leketia, « réaliste » pourrait vouloir dire **fidèle à l'objet réel** : les proportions d'un vrai leket, son bord coupé, la matière de l'écorce, la gravure. Il ne s'agirait pas d'un rendu photoréaliste. « Post-moderne » voudrait dire **une citation de la tradition mise en tension avec un code numérique**. Le tout reste une forme simple, que le système (Liquid Glass) ou un rendu de présentation peut ensuite enrichir.

---

## 4. Références calebasse

### 4.1 Le nom et l'objet au Sénégal

- Une source gambienne indique que la calebasse est appelée localement « lekket ». L'orthographe du wolof n'est pas standardisée. [S] [My Gambia, *The calabash*](https://www.my-gambia.com/mymagazine/the-calabash-a-container-bowl-and-an-instrument/)
- Un album de musique wolof mentionne des « leket calabashes » utilisées comme percussions, avec le tama, le sabar et le xalam. [S] [Cezame Music](https://en.cezamemusic.com/senegal-wolof-music-album-576.html)
- *Le Soleil* (reportage de Mariama Dième à Ndiassane, 1er octobre 2025) décrit la calebasse comme un symbole de prospérité, de fécondité, de solidarité et d'abondance, associé à la femme, à la mère et au foyer. On y met l'argent des marchandes. Des calebasses « gravées et pyrogravées en noir » y sont vendues, importées de Kayes (Mali). [V] [Le Soleil](https://lesoleil.sn/enquetes/reportages/calebasse-un-ustensile-qui-resiste-au-temps/)
- **Non trouvé** : aucune source sénégalaise publiée ne recense les motifs wolof, sérères ou peuls de gravure sur calebasse ni leur signification. Il faudrait chercher à l'IFAN Cheikh Anta Diop ou au Musée des civilisations noires, ou interroger directement des artisans.

### 4.2 Tableau des références

| Référence | Quoi, où | Ce qu'on en retient pour le logo | Lien |
|---|---|---|---|
| Calebasses de Ndiassane | Calebasses simples et pyrogravées vendues au Gamou (Sénégal, 2025) | Le leket est un **objet du quotidien**, pas un objet de musée. Il porte une symbolique d'abondance et de foyer, et la gravure noire sur fond clair est la norme locale. | [Le Soleil](https://lesoleil.sn/enquetes/reportages/calebasse-un-ustensile-qui-resiste-au-temps/) |
| Keur Design, Abdoulaye Mbaye | Atelier de design d'objets coordonné par Ousmane Mbaye (Institut français et Goethe-Institut), exposé à la Biennale de Dakar 2018. Abdoulaye Mbaye y fait des lampadaires en calebasse gravée. [S] | Précédent sénégalais de **calebasse traditionnelle réinterprétée en objet contemporain**. C'est l'esprit « post-moderne » demandé. | [Le Petit Journal Dakar](https://lepetitjournal.com/dakar/communaute/abdoulaye-mbaye-peintre-et-artisan-254767) |
| Biennale de Dakar 2024, design | Ousmane Mbaye commissaire de la section design, la première depuis 20 ans. [S] | Vivier de designers sénégalais à consulter ou à citer. | [Wallpaper](https://www.wallpaper.com/design-interiors/design-events/dakar-biennale-2024) |
| Calebasses du nord du Nigeria (Penn Museum) | Article de Mildred A. Konan, *Expedition*, 1974 : bols, gourdes entières, cuillers et louches, instruments. Techniques : gravure blanchie à la craie (Hausa), incisions frottées à l'huile et à la suie, brûlage au couteau chauffé au rouge (Tera, Bura), teinture puis gravure (Peuls), motifs pressés pendant la croissance. Offertes aux mariées. [V] | Inventaire précis des **formes** (bol, gourde, louche) et des **techniques** (incision, brûlure, teinte). La brûlure au couteau donne un trait noir épais : un trait graphique déjà « logo ». | [Penn Museum, *Calabashes in Northern Nigeria*](https://www.penn.museum/sites/expedition/calabashes-in-northern-nigeria/) |
| Collections Penn Museum | Bols de calebasse peuls et kanouri catalogués. [V, résultats] | Photos de référence de profils réels. | [objet 523667](https://collections.penn.museum/collections/object/523667) ; [objet 523668](https://collections.penn.museum/collections/object/523668) |
| Hearst Museum (Berkeley) | Bol pyrogravé à l'intérieur et à l'extérieur, motifs géométriques, usage de stockage ; louche en gourde pyrogravée. [V, résultats] | Le stockage est **l'usage d'origine**, ce qui colle à « tout reste sur l'appareil ». La louche est une forme alternative. | [Hearst, bol](https://portal.hearstmuseum.berkeley.edu/catalog/6e1c9e86-ce25-42e4-965b-8a816080b8ac) ; [Hearst, louche](https://portal.hearstmuseum.berkeley.edu/catalog/02457f54-1f76-4491-b565-e5b715420792) |
| Quai Branly, calebasses peules (Cameroun) | Notices citant l'ethnologue René Dognin : un motif central figure le python (« modaari ») et un décor en étoile évoque la protection. [S, résumé de recherche] | Les motifs gravés sont **des signes porteurs de sens**, pas un simple remplissage. | [Quai Branly, notice 449159](https://m.quaibranly.fr/en/explore-collections/base/Work/action/show/notice/449159-calebasse) ; [notice 449165](https://m.quaibranly.fr/en/explore-collections/base/Work/action/show/notice/449165-calebasse) |
| Calebasses du Bénin (exposition, Institut français) | Les significations des motifs se maintiennent en milieu rural ; losange, croissant et triangle pointe en bas renverraient à la femme. [S] | Le **triangle pointe en bas** est un signe documenté. Attention, la frise de triangles du pictogramme refusé reprenait ce code sans intention. [D] | [IF Bénin, PDF](https://if-benin.com/wp-content/uploads/2023/12/EXPO-CALEBASSE-correction.pdf) |
| Mali, calebasses décorées | Cœurs, noms de couples, symboles de bonheur. [S] | La calebasse **porte des messages** : un support d'écriture. | [Le360 Afrique](https://afrique.le360.ma/culture/mali-de-plante-potagere-a-oeuvres-dart-les-mille-et-un-usages-de-la-calebasse_YDMBITE6ORAYBISVEJRAQCJJHE/) |
| Igba Iwa, la « calebasse de l'existence » (yoruba) | Babatunde Lawal décrit le cosmos yoruba comme une gourde à deux moitiés. [S, essai reproduit sur un site tiers] Emma C. Rice, résumant Drewal et Pemberton (1989), décrit le monde visible et le monde invisible reliés par des chemins sur la calebasse. [V] | La calebasse est un **contenant du monde et un canal de communication**, une métaphore forte pour un journal de liens. **Attention** : c'est yoruba (Nigeria, Bénin), pas wolof. | [Lawal, *Ejiwapo*](https://oyekuofun.org/2014/10/25/ejiwapo-the-dialectics-of-twoness-in-yoruba-art-and-culture-by-babatunde-lawal/) ; [Rice, Leeds African Studies Bulletin, 2017](https://lucas.leeds.ac.uk/article/re-thinking-the-calabash-emma-christina-rice/) |
| La calebasse comme contenant du savoir | Rice : la calebasse sert à contenir et à cacher ; elle est la métaphore d'un savoir profond accumulé avec l'âge. [V] | « Contenir et garder privé » est l'exact positionnement de leketia (stockage local). | [Rice, 2017](https://lucas.leeds.ac.uk/article/re-thinking-the-calabash-emma-christina-rice/) |
| Kora (Met Museum) | Résonateur en calebasse couvert de peau, avec un long manche. [S, résumé de résultat] | Autre forme sénégalaise iconique, mais elle risque de lire « musique ». | [Met, collection](https://www.metmuseum.org/art/collection/search/501115) |
| Yinka Ilori et la calebasse | Article de Dwell : l'artiste britannico-nigérian dit puiser dans le bol en calebasse (article non lu, 403). | Précédent d'un designer contemporain reconnu qui fait de la calebasse un motif pop et coloré. | [Dwell](https://www.dwell.com/article/british-nigerian-artist-designer-yinka-ilori-calabash-bowls-51358fb7) |

### 4.3 La calebasse dans des identités de marque existantes

- **Dismoi Calabash Lights** : branding d'un fabricant de lampes en calebasse (Behance). Ce n'est pas une marque tech. [S] [Behance](https://www.behance.net/gallery/51070899/dismoi-Calabash-Lights-Branding)
- **Wild Calabash** : marque sud-africaine de spritzer, projet de packaging. [S] [Creativepool](https://creativepool.com/profile/486158/projects/wild-calabash-sparkling-spritzer)
- **Non trouvé** : aucune marque tech utilisant une calebasse comme symbole n'a été identifiée. C'est un territoire libre, à confirmer par une recherche de marques déposées (section 7).

---

## 5. Représenter la donnée sans 0/1

### 5.1 Métaphores possibles

| Métaphore | Exemples documentés | Statut | Lien |
|---|---|---|---|
| Pixel, carré modulaire | Mistral (pixel cat, M en pixels) | Encore utilisable, mais très en vogue en 2025-2026. Le « pixel » est aussi une réaction anti-IA. [S] | [Mistral Brand](https://mistral.ai/brand) ; [Freelogodesign 2026](https://www.freelogodesign.org/blog/2026/02/03/logo-design-10-visual-trends-to-watch-in-2026) |
| Cube ou bloc empilé | Docker (baleine portant des conteneurs ; depuis 2017, des silhouettes simplifiées) ; marque déposée « Moby Dock » | **À éviter** : territoire occupé par Docker, et cliché blockchain. [V/S] | [Docker, Trademark Guidelines](https://www.docker.com/?p=30142) ; [Logos-World, Docker](https://logos-world.net/docker-logo/) |
| Étincelle ✨ | Gemini (spark, dégradé aux couleurs Google, juin 2025), Notion, Spotify | **Cliché**. NN/g (Kate Kaplan, 20/09/2024) : aucun participant de l'étude n'associe spontanément l'étincelle à l'IA, qui est souvent lue comme « favori ». [V] | [NN/g](https://www.nngroup.com/articles/ai-sparkles-icon-problem/) ; [9to5Google](https://9to5google.com/2025/06/30/new-gemini-icon/) ; [Studio Output](https://www.studio-output.com/thought/when-did-ai-brands-become-just-a-sparkle/) |
| Dégradé violet-bleu, orbe, blob | Nombreuses marques IA | **Cliché**, et facteur de défiance selon certains commentateurs. [S] | [The Drum](https://www.thedrum.com/opinion/rob-pratt-why-do-so-many-ai-brands-look-exactly-the-same) ; [Indie Hackers](https://www.indiehackers.com/post/the-ai-purple-problem-why-every-ai-brand-looks-the-same-6cb0aa2a02) ; [Creative Bloq, *AI has a branding problem*](https://www.creativebloq.com/design/branding/ai-has-a-branding-problem) |
| Rosace ou anneau radial | Plusieurs logos d'entreprises d'IA en rosace, critiqués pour leur ressemblance | **Cliché**. [S] | [VelvetShark](https://velvetshark.com/ai-company-logos-that-look-like-buttholes) ; [DesignRush, Claude](https://www.designrush.com/best-designs/logo/claude-logo-design-the-ai-mark-built-to-look-none-of-its-rivals) |
| Réseau de nœuds, cerveau, circuit | Logos « tech africaine » génériques (ex. un continent fait de nœuds) | **Cliché**. [S] | [Ebaq Design](https://www.ebaqdesign.com/blog/why-ai-startups-look-the-same) ; [Contra, Connect IT Africa](https://contra.com/p/vmB3leFb-networking-logo-design) |
| Barres, trame de balayage | IBM, bandes horizontales (Paul Rand) | Classique et intemporel. Une trame de lignes peut évoquer l'écran sans chiffres. [D] | [Quartz, IBM et Paul Rand](https://qz.com/461040/how-to-design-an-enduring-logo-lessons-from-ibm-and-paul-rand) |
| Point et trame de points | Les points de pyrogravure (section 4) ; la trame de points d'écran | **Piste propre à leketia** : un point gravé est un bit sans chiffre. [D] | — |
| Contenant (boîte, poche, goutte) | Dropbox (boîte ouverte), Pocket (poche, service fermé par Mozilla le 8 juillet 2025), Raindrop (goutte) | **Catégorie directe de leketia** : il faut s'en distinguer, mais la logique « un contenant simple » a fait ses preuves. [V/S] | [Dezeen, Dropbox](https://www.dezeen.com/2017/10/11/dropbox-rebrand-logo-visual-identity-graphic-design/amp/) ; [Mozilla, fin de Pocket](https://support.mozilla.org/ml/kb/future-of-pocket) ; [Pocket Design, Medium](https://medium.com/pocket-design/refreshing-your-pocket-407d75203934) |
| Flux, onde | — | Risque de confusion avec Wave (fintech très présente au Sénégal, logo pingouin) si l'onde domine. [D] | [Osiris, Wave](https://osiris.sn/wave-la-tornade-bleue-qui-s-impose-dans-le-paiement-mobile-en-afrique-de-l.html) |

### 5.2 Conclusion pour leketia **[D]**

La donnée n'a pas besoin d'un symbole à elle. Trois approches sont sobres :
1. **le point ou le trait gravé** : la donnée prend la forme du motif artisanal ;
2. **une coupe nette, orthogonale**, dans une forme organique : le geste numérique se lit comme une découpe ;
3. **la trame** : de fines lignes parallèles, comme une gravure ou un balayage d'écran.

Chacune ajoute **un seul** élément à la silhouette du leket.

### 5.3 Logos à ne pas approcher

Docker (cubes et conteneurs), Dropbox (losanges en boîte), Pocket (poche, marque morte mais connue), Raindrop.io (goutte), Gemini, Notion et toute étoile à quatre branches, Mistral (pixels en bandes), Wave (pingouin, bleu clair) dans le contexte sénégalais, Leket Israel (même nom). *Le logo de Raindrop.io n'a pas pu être documenté par une source : à vérifier visuellement.*

---

## 6. Fusions culture et numérique réussies

| Exemple | Ce qui est fusionné | Ce qu'on en retient | Lien |
|---|---|---|---|
| Flutterwave (Verve, février 2022) | Système bâti sur « LabaLaba », le mot yoruba pour papillon (le symbole existant). L'agence a refusé les verts et bleus froids de la fintech pour rester « authentiquement africaine ». [V] | Un **mot de langue africaine** devient le cœur d'un système, comme « leket ». | [Creative Boom](https://www.creativeboom.com/work/verves-new-identity-for-flutterwave-is-a-celebration-of-african-entrepreneurial-spirit/) |
| Green Africa (Pentagram, Eddie Opara, avec Dá Design Studio de Lagos) | Le logo combine le continent, un « g » et une flèche de boussole. Le motif s'inspire des textiles africains et les icônes de la structure des masques d'Afrique de l'Ouest. [V] | La culture passe par le **système** (motif, icônes), pendant que le logo reste simple. C'est aussi une collaboration avec un studio local. | [Pentagram, Green Africa](https://pentagram.com/work/green-africa/story) |
| Harambeans (Pentagram, Marina Willer, 2018) | Un « H » en deux parties qui s'emboîtent, comme un aimant ; rejet explicite des clichés visuels sur l'identité africaine. [V/S] | Montre qu'**éviter le cliché « africain »** est un objectif de conception. | [Pentagram](https://pentagram.com/work/harambeans) ; [Design Week](https://www.designweek.co.uk/pentagram-marina-willer-creates-african-entrepreneur-network-harambeans-new-look/) |
| Yolélé (Pentagram, Paula Scher) | Marque de fonio fondée par le chef sénégalais Pierre Thiam ; identité tirée d'une carte de l'Afrique dessinée à la main, avec une typographie et des icônes dessinées. [V] | Une marque **sénégalaise** traitée par un grand studio, avec le dessin à la main comme signe d'authenticité. | [Pentagram, Yolélé](https://pentagram.com/work/yolele/story) |
| Oku (DutchScot, 2022) | Start-up africaine, art rwandais revisité (article non lu, 403 ; titre seul vérifié). | À lire pour un exemple d'**art traditionnel converti en logo adaptable**. | [Design Week](https://www.designweek.co.uk/issues/30-may-6-june-2022/oku-branding/) |
| JADA (FourthCanvas, Lagos, mai 2025) | Plateforme de talents IA et données. Identité par un studio africain (article non lu, 403). | Cas le plus proche thématiquement (**IA et données en Afrique**) : à examiner directement. | [TechCabal](https://techcabal.com/2025/05/28/inside-jadas-brand-transformation-with-fourthcanvas-positioning-africas-ai-and-data-workforce/) |
| Tolu Microfinance (Polybox) | Formes géométriques inspirées des motifs du kitenge (Afrique de l'Est). [S] | Un motif textile réduit à la géométrie. | [Polybox](https://polybox.studio/case-studies/tolu-branding-webflow) |
| Belonwus (Lagos) | Studio qui applique à la culture africaine le niveau de design de la fintech. [S] | Studio africain de référence pour l'approche. | [Culture Custodian](https://culturecustodian.com/belonwus-on-why-african-culture-needs-the-same-design-thinking-as-fintech/) ; [TechCabal](https://techcabal.com/?p=160905) |

**Limite** : aucun exemple trouvé ne fusionne précisément **un objet artisanal** (et non un textile ou un mot) avec **un concept de donnée**. Le croisement exact que vise leketia semble inédit, ce qui est une chance mais oblige à construire sans modèle direct.

---

## 7. Antériorité du nom et du motif

| Recherche | Résultat | Risque | Lien |
|---|---|---|---|
| « Leketia » (recherche approfondie) | Aucune marque, app ni entreprise trouvée. Uniquement des prénoms de personnes (annuaires). | Faible (recherche web seulement) | [résultats ZoomInfo, exemple](https://www.zoominfo.com/p/Leketia-Dozier/17615770589) |
| « Leket » | **Leket Israel**, banque alimentaire nationale d'Israël (ONG, logo déposé, sites leket.org). Ce n'est pas une app tech. | Moyen pour le nom court « Leket » ; faible pour « leketia » | [Leket Israel](https://www.leket.org/en/about-leket/) ; [Wikipedia](https://en.wikipedia.org/wiki/Leket_Israel) |
| Apps au nom proche | **LekeeLekee** (super-app sociale nigériane, ARISE/THISDAY, 2026) ; **Fumay Lekk** (restaurants, Sénégal). | Faible à moyen (sonorité proche de LekeeLekee) | [Arise](https://www.arise.tv/lekeelekee-homegrown-social-super-appgoes-live-on-app-store-google-play-web) ; [App Store, Fumay Lekk](https://apps.apple.com/us/app/id1561571616) |
| « Calabash » en tech | **Calabash**, framework open source de test d'apps mobiles créé par Xamarin, dont Microsoft a cessé les contributions vers 2017. | Faible (projet arrêté, nom différent) | [GitHub calabash-ios (fork)](https://github.com/iMerica/calabash-ios) ; [Toptal](https://www.toptal.com/developers/app/android-ios-ui-testing-calabash) |
| Calebasse comme symbole tech | Rien trouvé. | — | — |

**À faire avant diffusion (non fait ici)** : interroger les bases de marques de l'OAPI (marques valables au Sénégal), de l'EUIPO, de l'INPI et de l'USPTO pour « LEKETIA » et « LEKET » en classes 9 et 42, puis faire une recherche d'image inversée sur la silhouette finale. Cette recherche web ne remplace pas une recherche de marques.

---

## 8. Pourquoi les trois propositions refusées ont échoué

| Proposition | Ce qui ne va pas, au regard des sources |
|---|---|
| **1. Pictogramme plat : bol, frise de triangles, « 101 »** | Le « 101 » est **littéral** : Rand rappelle qu'un logo identifie et ne décrit pas. C'est aussi le cliché « binaire » que la porteuse a ensuite fait retirer. Il y a trois idées (bol, frise, chiffres), alors qu'Apple demande « un minimum de formes ». La frise de triangles est décorative et sans intention, alors que le triangle pointe en bas a un sens documenté au Bénin. Le dessin au trait n'avait ni la masse ni la matière attendues, d'où la demande « réaliste ». **[D]** |
| **2. Rendu 3D : bol gravé, cubes blancs et orange, grille de cubes, disque indigo** | Trop de couleurs et d'éléments : au moins quatre (bol, cubes, grille, disque), soit le contraire de la règle de simplicité de Haviv et d'Apple. Les cubes sont le **territoire de Docker** et du cliché blockchain. Les effets (ombres, lumières) sont « cuits » dans l'image alors qu'Apple demande de laisser le système les appliquer. Il n'existe pas de version plate de référence, donc aucune version une couleur fiable. Le test à 16 px n'a pas été fait avant le rendu. **[D]** |
| **3. Rendu 3D : bol terre cuite lisse, dôme de cubes en escalier, deux cubes qui s'échappent** | **Mauvais matériau** : une calebasse est une écorce de fruit (*Crescentia cujete*, d'après *Le Soleil*), légère, beige à ocre, à bord coupé et souvent pyrogravée en noir. La terre cuite lisse lit « poterie », et le rendu ressemble à du plastique : ce n'est donc pas « réaliste » au sens de fidèle à l'objet. Les cubes restent du cliché ; le dôme en escalier est une **forme de pile** qui rappelle Docker (la variante intermédiaire le confirmait). Les deux cubes qui s'échappent forment un cliché de plus (« les données s'envolent »), qui contredit d'ailleurs le positionnement « tout reste sur l'appareil ». Enfin, la version plate a été extraite du rendu, alors que toutes les marques étudiées font l'inverse. **[D]** |

**Cause commune [D]** : le processus a été inversé. On a produit des rendus finis avant d'avoir fixé (a) l'idée unique, (b) le sens des mots « réaliste post-moderne » pour la porteuse, (c) une silhouette qui passe le test de réduction. On a aussi pris le cube, le premier symbole venu de la donnée, au lieu de chercher dans la calebasse elle-même (gravure, coupe, contenant).

---

## 9. Brief créatif (gabarit *art-direction*, adapté à un logo)

### Projet : symbole et logotype leketia

**Type de projet :** identité, logo (symbole, logotype, icône d'app)
**Supports :** icône PWA (maskable), iOS (Liquid Glass : défaut, sombre, clair, teinté), Android (adaptive et monochrome), favicon, GitHub et réseaux sociaux, impression une couleur (autocollant, tampon, t-shirt)
**Décisionnaire :** la porteuse du projet, seule voix d'arbitrage créatif
**Budget :** open source, bénévole (à confirmer)

#### 1. Contexte
- **Pourquoi** : leketia est un journal de liens personnel, open source, où rien ne quitte l'appareil. Son nom vient du *leket*, la calebasse-bol en wolof, et de « IA ».
- **À accomplir** : être reconnue au premier coup d'œil sur un écran d'accueil, porter une origine sénégalaise sans folklore, et tenir en une couleur.
- **Mesure** : la porteuse dit oui ; l'icône se distingue à 16 px et dans une rangée d'icônes ; 5 personnes qui ne connaissent pas le projet ne la confondent avec aucune marque connue.

#### 2. Concept
- **L'idée (une phrase)** : *le leket, le récipient où l'on garde ce qui compte, gravé du signe de la donnée.*
- **Pourquoi maintenant** : les marques d'IA se ressemblent toutes (étincelles, dégradés violets, rosaces). Un objet réel, situé et artisanal, se distingue tout de suite. La tendance 2026 au « tactile » valorise la marque de la main.
- **Ce que le concept rejette** : les chiffres 0/1, les cubes, les étincelles, les cerveaux et réseaux, les dégradés violets, la terre cuite, le plastique, le décor « africain » générique (carte du continent, masques).

#### 3. Public
- **Principal** : des personnes qui sauvegardent beaucoup de contenus sociaux (X, Instagram, YouTube, TikTok, Pinterest), soucieuses de leur vie privée, francophones et anglophones, dont la diaspora et le public sénégalais.
- **Ce qu'elles ressentent aujourd'hui** : leurs liens sont dispersés et appartiennent aux plateformes.
- **Ce qu'elles doivent ressentir** : « c'est à moi, c'est gardé, c'est beau ».

#### 4. Sujet
- **Objet** : un leket réel, vu de profil (demande n° 3 de la porteuse), aux proportions d'une vraie calebasse coupée.
- **Accessoire obligatoire** : un seul signe de la donnée (point gravé, coupe orthogonale ou trame).
- **Interdits** : chiffres, cubes, étoile à quatre branches, cerveau, nœuds, continent africain.

#### 5. Composition
| Support | Format | Exigence |
|---|---|---|
| iOS | 1024×1024, calques SVG | Fond et un ou deux calques de premier plan, bords nets, sans effets dessinés |
| Android | 108 dp, zone sûre de 66 dp | Calque monochrome obligatoire |
| PWA | 512 px maskable | Tout l'essentiel dans un cercle de rayon 40 % |
| Favicon | SVG, 16 et 32 px | Silhouette seule |
| Impression | Vectoriel, 1 couleur | Fonctionne aussi en tampon et en pyrogravure |

- **Cadrage** : profil strict, centré, avec beaucoup de marge.

#### 6. Lumière et matière (couche « réaliste », seulement après validation de la forme)
- Lumière douce et latérale, comme celle d'un objet posé.
- Matière : écorce mate, beige à ocre ; gravure noire brûlée, légèrement en creux.
- Sur iOS : le système apporte le verre et les reflets ; ne rien ajouter.

#### 7. Couleur
- **Base [D, à valider]** : deux couleurs au maximum. Un ocre de calebasse et un noir de pyrogravure, ou une couleur seule sur blanc. La version une couleur est la version maîtresse.
- **Interdits** : dégradé violet-bleu, plus de deux couleurs dans le symbole.

#### 8. Ton
- Situé, pas folklorique.
- Précis, pas technique.
- Chaleureux, pas mignon.
- Contemporain, pas à la mode.

#### 9. Moodboard (10 à 15 images, chacune annotée de ce qu'on lui prend)
Photos de calebasses réelles (Penn Museum, Hearst, Quai Branly, *Le Soleil*) ; une lampe de Keur Design ; IBM de Rand (trame) ; Dropbox 2017 (suggestion de contenant) ; Mistral (version monochrome officielle) ; icônes Apple Liquid Glass (calques). Plus les 3 images choisies par la porteuse.

#### 10. À éviter
- Cubes, Docker, blockchain.
- Étincelle IA, dégradé violet, rosace.
- 0/1 et code binaire.
- Rendu 3D figé dans l'icône ; matière plastique ou terre cuite.
- Continent, masque, décor « tribal » générique.

#### 11. Livrables
Symbole (SVG), logotype « leketia » (SVG), lockups horizontal et vertical, versions noire, blanche et une couleur, fichier Icon Composer (.icon), icône adaptive Android (premier plan, fond, monochrome), icônes PWA (any et maskable), favicon SVG et ICO, planche de construction, une page de règles d'usage.

#### 12. Jalons
1. Validation du brief et des réponses aux questions.
2. Planche de 30 silhouettes (noir sur blanc).
3. 3 pistes en situation.
4. Piste choisie, réglage fin.
5. Couche matière et déclinaisons.

#### 13. Validation
- Une seule décisionnaire : la porteuse.
- Deux tours de retours au maximum par jalon.
- Les retours portent sur la forme au jalon 2, jamais sur le rendu.

#### 14. Questions à poser à la porteuse (décisions qui lui reviennent)

1. **Lexique** : montrez-moi 3 images (logos, objets, affiches) qui sont pour vous « réalistes post-modernes », et 3 qui ne le sont pas.
2. **Idée unique** : le symbole doit-il d'abord dire *« je garde »* (le contenant), *« je viens de chez nous »* (l'origine) ou *« c'est intelligent »* (l'IA) ? On ne peut en mettre qu'une au premier plan.
3. **Forme** : quel leket ? Le bol coupé peu profond, le bol profond, la gourde entière ou la louche ? Avez-vous une calebasse réelle chez vous à photographier de profil ?
4. **Gravure** : la pyrogravure noire fait-elle partie de *votre* image du leket ? Connaissez-vous des motifs sénégalais précis (et leur sens) à citer, ou au contraire à ne pas utiliser ?
5. **Référence yoruba** : la « calebasse du monde » (Igba Iwa) est yoruba, pas wolof. Est-ce acceptable, ou faut-il rester strictement sénégalais ?
6. **Couleur** : ocre et noir (fidèles à l'objet) ou une couleur signature plus franche ? Y a-t-il une couleur à éviter (par exemple le bleu de Wave ou l'orange d'Orange) ?
7. **Logotype** : « leketia » tout en minuscules ? Faut-il distinguer visuellement « leket » et « ia » ?
8. **Usage d'impression prioritaire** : autocollant, t-shirt, tampon, pyrogravure sur de vraies calebasses ?
9. **Collaboration** : souhaitez-vous associer un ou une artisane graveuse, ou un studio de Dakar, pour que le motif soit authentique ?

#### 15. Validation finale
Brief approuvé par : la porteuse, [date].

---

## 10. Pistes de direction (en mots, sans image)

### Piste A : « Le leket gravé »
- **Description** : silhouette pleine d'un leket coupé, de profil, peu profond, au bord légèrement irrégulier comme une vraie coupe. Sur la panse, une **seule rangée de points gravés** (3 à 5 en icône, plus en grand format), alignés avec une régularité de trame d'écran. Le point gravé tient lieu de bit. En une couleur, ce sont des trous dans la silhouette. Sur iOS, la calebasse est un calque et les points un second calque.
- **Références** : pyrogravure de Ndiassane, calebasses du Penn Museum, trame IBM.
- **Forces** : un seul ajout ; motif authentique ; reste lisible en petit si les points sont gros ; très imprimable (tampon, pyrogravure).
- **Risques** : à 16 px, les points disparaissent (prévoir une version favicon à 2 ou 3 points ou sans points) ; peut lire « bol de céréales » si les points sont mal proportionnés.

### Piste B : « La coupe numérique »
- **Description** : le leket de profil, entier et organique. La ligne de coupe du bord est **parfaitement droite et légèrement en marche d'escalier** : un seul cran net, comme un pixel. La donnée se lit dans la précision de la découpe, en contraste avec la courbe vivante du fruit. C'est la tension organique / numérique, une contradiction post-moderne réduite à un détail.
- **Références** : Dropbox 2017 (suggestion plutôt que description), Mistral (pixel), objets de Keur Design.
- **Forces** : silhouette très simple et donc très reconnaissable ; excellente en une couleur ; aucune ressemblance avec Docker (pas de cubes) ; le détail récompense le regard.
- **Risques** : trop subtil, l'idée « donnée » peut passer inaperçue ; le cran peut ressembler à une erreur de dessin s'il n'est pas assumé.

### Piste C : « Le contenant du monde » (deux moitiés)
- **Description** : deux moitiés de calebasse, un bol en bas et un couvercle renversé en haut, séparées par **un mince interstice lumineux**. L'interstice, c'est le lien qui entre et qui est gardé. Fermé, c'est privé ; entrouvert, c'est le partage.
- **Références** : Igba Iwa (Lawal), Rice et Drewal (chemins entre les mondes), positionnement « stockage local ».
- **Forces** : narration riche (garder, cacher, relier) ; forme symétrique et forte ; l'interstice fonctionne bien avec Liquid Glass.
- **Risques** : référence yoruba plutôt que wolof (question 5) ; peut évoquer une pilule, une coquille ou un macaron ; ce n'est plus un « vrai leket de profil » au sens strict.

### Piste D : « La louche qui recueille »
- **Description** : une louche en calebasse (bol et manche naturel), de profil, qui recueille. Sauvegarder un lien, c'est puiser. Le manche donne une **silhouette asymétrique, rare et mémorable**. La donnée est une goutte carrée (une seule) au-dessus du bol.
- **Références** : louche pyrogravée du Hearst Museum ; inventaire des formes de Konan (Penn Museum).
- **Forces** : silhouette distinctive, loin des bols génériques ; geste actif (« je recueille ») qui colle à l'action principale de l'app.
- **Risques** : peut lire « cuillère » ou « cuisine » ; l'élément carré rappelle les cubes refusés s'il est mal dosé ; le nom dit « bol », pas « louche ».

### Piste E : « Logotype d'abord »
- **Description** : Haviv rappelle qu'un symbole doit avoir une raison d'être, sinon on travaille le nom. Ici, un logotype « leketia » en minuscules, dessiné sur mesure, où **le « e » ou l'œil d'une lettre devient un petit leket de profil**, et où le point du « i » est un point gravé carré. Le symbole d'app est extrait de cette lettre.
- **Références** : entretien Haviv (symbole ou nom), Yolélé (typographie dessinée à la main).
- **Forces** : le nom, rare et beau, est mis en avant ; cohérence parfaite entre logo et icône ; peu de risque de cliché.
- **Risques** : moins « objet réaliste » que ce que la porteuse a demandé ; l'icône extraite d'une lettre peut être faible seule ; demande un vrai travail typographique.

**Recommandation [D]** : présenter **A, B et E** en situation. A et B répondent directement à « une vraie calebasse de profil » et à « représenter la donnée ». E est la piste de sécurité. C et D sont à proposer seulement si la porteuse répond favorablement aux questions 3 et 5.

---

## 11. Sources

### Méthode et principes
- Paul Rand, *Logos, Flags, and Escutcheons* (1991) : https://www.paulrand.design/writing/articles/1991-logos-flags-and-escutcheons.html
- Michael Bierut, It's Nice That (2015) : https://itsnicethat.com/features/michael-bierut-logo-design
- Michael Bierut, Design Observer : https://designobserver.com/the-mysterious-power-of-context/
- Sagi Haviv, Logo Design Love : https://www.logodesignlove.com/sagi-haviv-interview
- Sagi Haviv, LogoGeek : https://logogeek.uk/podcast/sagi-haviv/
- 99% Invisible (Haviv) : https://99percentinvisible.org/?p=23649
- Haviv, Skillshare : https://www.skillshare.com/en/classes/designing-brand-symbols-the-principles-and-process-of-making-logos-that-last/404415631
- *Identify* (C&G&H, 2011) : https://www.simonandschuster.ca/books/Identify/Tom-Geismar/9781440320477
- IBM et Paul Rand, Quartz : https://qz.com/461040/how-to-design-an-enduring-logo-lessons-from-ibm-and-paul-rand

### Guides officiels d'icônes
- Apple HIG, App icons : https://developer.apple.com/design/human-interface-guidelines/app-icons
- Apple, Icon Composer : https://developer.apple.com/icon-composer/
- Apple, WWDC25 session 361 : https://developer.apple.com/videos/play/wwdc2025/361
- Android, Adaptive icons : https://developer.android.com/develop/ui/views/launch/icon_design_adaptive
- web.dev, Maskable icons : https://web.dev/articles/maskable-icon

### Post-moderne et tendances
- V&A, *What is Postmodernism?* : https://www.vam.ac.uk/articles/what-is-postmodernism
- Dezeen, guide du postmodernisme : https://www.dezeen.com/?p=740006
- Artforum : https://www.artforum.com/events/postmodernism-191704/
- Design Observer, *Did we ever stop being postmodern?* : https://designobserver.com/did-we-ever-stop-being-postmodern/
- It's Nice That, Airbnb (2025) : https://www.itsnicethat.com/articles/airbnb-app-redesign-140525
- Bloomberg (non lu, 403) : https://www.bloomberg.com/news/articles/2025-06-13/apple-airbnb-ditch-flat-app-icons-for-new-3d-ui-design
- Creative Bloq, icônes Apple et Airbnb : https://www.creativebloq.com/web-design/ux-ui/from-apple-to-airbnb-retro-icon-design-is-making-a-comeback
- Midst Labs : https://midstlabs.substack.com/p/skin-deep-human-centered-design
- Automattic Design : https://automattic.design/2025/07/01/from-flat-to-feel/
- Microsoft Design : https://microsoft.design/articles/fluid-forms-vibrant-colors/
- Dezeen, icônes Microsoft : https://www.dezeen.com/2025/10/06/microsoft-office-icons-rebrand/amp/
- Microsoft 365 Insider : https://techcommunity.microsoft.com/blog/microsoft365insiderblog/new-microsoft-365-icons-for-the-ai-era/4458674
- Mistral Brand : https://mistral.ai/brand
- Logos-World, Mistral : https://logos-world.net/mistral-ai-unveils-new-logo-and-brand-identity/
- Creative Bloq, tendances 2026 : https://www.creativebloq.com/design/logos-icons/these-logo-design-trends-will-define-2026
- Creative Bloq, *Texture, warmth and tactile rebellion* : https://www.creativebloq.com/design/graphic-design/texture-warmth-and-tactile-rebellion-the-big-graphic-design-trends-for-2026
- Kota : https://kota.co.uk/blog/branding-inspiration-brand-design-trends-for-2026
- Freelogodesign 2026 : https://www.freelogodesign.org/blog/2026/02/03/logo-design-10-visual-trends-to-watch-in-2026
- Dropbox, Design Week : https://www.designweek.co.uk/issues/2-8-october-2017/dropbox-rebrands-show-just-file-storage/
- Dropbox, Dezeen : https://www.dezeen.com/2017/10/11/dropbox-rebrand-logo-visual-identity-graphic-design/amp/

### Calebasse
- *Le Soleil* (2025) : https://lesoleil.sn/enquetes/reportages/calebasse-un-ustensile-qui-resiste-au-temps/
- My Gambia : https://www.my-gambia.com/mymagazine/the-calabash-a-container-bowl-and-an-instrument/
- Cezame Music : https://en.cezamemusic.com/senegal-wolof-music-album-576.html
- Le Petit Journal Dakar (Abdoulaye Mbaye) : https://lepetitjournal.com/dakar/communaute/abdoulaye-mbaye-peintre-et-artisan-254767
- Wallpaper, Biennale de Dakar 2024 : https://www.wallpaper.com/design-interiors/design-events/dakar-biennale-2024
- Penn Museum, Konan (1974) : https://www.penn.museum/sites/expedition/calabashes-in-northern-nigeria/
- Penn Museum, objets : https://collections.penn.museum/collections/object/523667 ; https://collections.penn.museum/collections/object/523668
- Hearst Museum : https://portal.hearstmuseum.berkeley.edu/catalog/6e1c9e86-ce25-42e4-965b-8a816080b8ac ; https://portal.hearstmuseum.berkeley.edu/catalog/02457f54-1f76-4491-b565-e5b715420792
- Quai Branly : https://m.quaibranly.fr/en/explore-collections/base/Work/action/show/notice/449159-calebasse ; https://m.quaibranly.fr/en/explore-collections/base/Work/action/show/notice/449165-calebasse
- IF Bénin, exposition Calebasse : https://if-benin.com/wp-content/uploads/2023/12/EXPO-CALEBASSE-correction.pdf
- Le360, Mali : https://afrique.le360.ma/culture/mali-de-plante-potagere-a-oeuvres-dart-les-mille-et-un-usages-de-la-calebasse_YDMBITE6ORAYBISVEJRAQCJJHE/
- Lawal, *Ejiwapo* : https://oyekuofun.org/2014/10/25/ejiwapo-the-dialectics-of-twoness-in-yoruba-art-and-culture-by-babatunde-lawal/
- Rice, *Re-thinking the Calabash* (2017) : https://lucas.leeds.ac.uk/article/re-thinking-the-calabash-emma-christina-rice/
- Met, kora : https://www.metmuseum.org/art/collection/search/501115
- Dwell, Yinka Ilori (non lu, 403) : https://www.dwell.com/article/british-nigerian-artist-designer-yinka-ilori-calabash-bowls-51358fb7
- Behance, Dismoi Calabash Lights : https://www.behance.net/gallery/51070899/dismoi-Calabash-Lights-Branding
- Creativepool, Wild Calabash : https://creativepool.com/profile/486158/projects/wild-calabash-sparkling-spritzer

### Donnée, IA et clichés
- NN/g, Sparkles (2024) : https://www.nngroup.com/articles/ai-sparkles-icon-problem/
- Studio Output : https://www.studio-output.com/thought/when-did-ai-brands-become-just-a-sparkle/
- The Drum : https://www.thedrum.com/opinion/rob-pratt-why-do-so-many-ai-brands-look-exactly-the-same
- Indie Hackers : https://www.indiehackers.com/post/the-ai-purple-problem-why-every-ai-brand-looks-the-same-6cb0aa2a02
- Creative Bloq, *AI has a branding problem* : https://www.creativebloq.com/design/branding/ai-has-a-branding-problem
- VelvetShark : https://velvetshark.com/ai-company-logos-that-look-like-buttholes
- DesignRush, Claude : https://www.designrush.com/best-designs/logo/claude-logo-design-the-ai-mark-built-to-look-none-of-its-rivals
- Ebaq Design : https://www.ebaqdesign.com/blog/why-ai-startups-look-the-same
- 9to5Google, Gemini : https://9to5google.com/2025/06/30/new-gemini-icon/
- Docker, Trademark Guidelines : https://www.docker.com/?p=30142
- Logos-World, Docker : https://logos-world.net/docker-logo/
- Mozilla, fin de Pocket : https://support.mozilla.org/ml/kb/future-of-pocket
- Pocket Design : https://medium.com/pocket-design/refreshing-your-pocket-407d75203934
- Osiris, Wave : https://osiris.sn/wave-la-tornade-bleue-qui-s-impose-dans-le-paiement-mobile-en-afrique-de-l.html

### Fusions culture et numérique
- Creative Boom, Flutterwave : https://www.creativeboom.com/work/verves-new-identity-for-flutterwave-is-a-celebration-of-african-entrepreneurial-spirit/
- Pentagram, Green Africa : https://pentagram.com/work/green-africa/story
- Pentagram, Harambeans : https://pentagram.com/work/harambeans
- Design Week, Harambeans : https://www.designweek.co.uk/pentagram-marina-willer-creates-african-entrepreneur-network-harambeans-new-look/
- Pentagram, Yolélé : https://pentagram.com/work/yolele/story
- Design Week, Oku (non lu, 403) : https://www.designweek.co.uk/issues/30-may-6-june-2022/oku-branding/
- TechCabal, JADA (non lu, 403) : https://techcabal.com/2025/05/28/inside-jadas-brand-transformation-with-fourthcanvas-positioning-africas-ai-and-data-workforce/
- Polybox, Tolu : https://polybox.studio/case-studies/tolu-branding-webflow
- Culture Custodian, Belonwus : https://culturecustodian.com/belonwus-on-why-african-culture-needs-the-same-design-thinking-as-fintech/

### Antériorité
- Leket Israel : https://www.leket.org/en/about-leket/ ; https://en.wikipedia.org/wiki/Leket_Israel
- LekeeLekee : https://www.arise.tv/lekeelekee-homegrown-social-super-appgoes-live-on-app-store-google-play-web
- Fumay Lekk : https://apps.apple.com/us/app/id1561571616
- Calabash (test mobile) : https://github.com/iMerica/calabash-ios ; https://www.toptal.com/developers/app/android-ios-ui-testing-calabash

### Lacunes connues
Aucune source sénégalaise publiée sur le répertoire des motifs wolof ou sérères n'a été trouvée. Plusieurs articles n'ont pas pu être lus (403) : Bloomberg, Dwell, Design Week (Oku) et TechCabal (JADA). Les livres de Haviv et de Bierut n'ont pas été lus dans le texte. Aucune recherche en base de marques déposées n'a été faite.
